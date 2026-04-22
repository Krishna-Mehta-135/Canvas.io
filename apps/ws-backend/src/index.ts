import "@repo/backend-common/config";
import {WebSocketServer, WebSocket} from "ws";
import {subscribeDurableRoomEvents, subscribeRoomPersistJobs} from "@repo/queue-sync";
import {checkUser} from "./ws/auth.js";
import {
    activeRooms,
    broadcastRoomPresenceState,
    broadcastToRoomAll,
    leaveActiveRoom,
    registerUser,
    removeRoomPresence,
    removeUserSocket,
} from "./ws/connectionState.js";
import {handleSocketMessage} from "./ws/messageHandler.js";
import {cacheRoomSyncState, persistShapes, roomSyncState} from "./ws/roomSync.js";
import {NODE_ID, subscribeRoomEvents} from "@repo/redis-sync";
import type {AuthenticatedWebSocket} from "./ws/types.js";
import type {ServerMessage} from "@repo/common";
import type {RoomSnapshotBroadcastEvent} from "@repo/common/ws-protocol";
import {
    recordCrossNodeVersionRegression,
    recordDuplicateCrossNodeEvent,
    recordConnectionClosed,
    recordConnectionOpened,
    recordDurableEventConsumed,
    recordInboundMessage,
    recordRedisFanoutEvent,
    startMetricsReporter,
} from "./ws/metrics.js";

const wss = new WebSocketServer({port: 8080});
const RABBITMQ_RETRY_DELAY_MS = 2000;

console.log("WebSocket server online on port 8080");
startMetricsReporter();

const seenActionIds = new Map<string, number>();
const ACTION_ID_TTL_MS = 2 * 60 * 1000;

function rememberAction(actionId: string) {
    seenActionIds.set(actionId, Date.now());
}

function hasSeenAction(actionId: string) {
    const seenAt = seenActionIds.get(actionId);
    if (!seenAt) {
        return false;
    }

    if (Date.now() - seenAt > ACTION_ID_TTL_MS) {
        seenActionIds.delete(actionId);
        return false;
    }

    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [actionId, seenAt] of seenActionIds) {
        if (now - seenAt > ACTION_ID_TTL_MS) {
            seenActionIds.delete(actionId);
        }
    }
}, ACTION_ID_TTL_MS).unref();

async function applyCrossNodeRoomEvent(event: RoomSnapshotBroadcastEvent, source: "redis" | "rabbitmq") {
    if (event.originNodeId === NODE_ID) {
        return;
    }

    if (hasSeenAction(event.actionId)) {
        recordDuplicateCrossNodeEvent();
        return;
    }

    rememberAction(event.actionId);

    const cachedState = roomSyncState.get(event.roomId);
    if (cachedState && event.version <= cachedState.version) {
        recordCrossNodeVersionRegression();
        return;
    }

    if (cachedState && event.version > cachedState.version + 1) {
        // We can still apply because events carry full snapshots, but this
        // indicates transport lag or a missed intermediate version.
        recordCrossNodeVersionRegression();
    }

    cacheRoomSyncState({
        roomId: event.roomId,
        version: event.version,
        shapes: event.shapes,
    });

    if (source === "rabbitmq") {
        recordDurableEventConsumed();
    } else {
        recordRedisFanoutEvent(Math.max(0, Date.now() - event.publishedAtMs));
    }

    const localRoomSockets = activeRooms.get(event.roomId);
    if (!localRoomSockets || localRoomSockets.size === 0) {
        return;
    }

    const message: ServerMessage = {
        type: event.type,
        roomId: event.roomId,
        version: event.version,
        shapes: event.shapes,
        senderId: event.senderId ?? "unknown",
        actionId: event.actionId,
    };

    broadcastToRoomAll(event.roomId, message);
}

// Cross-node room events use a hybrid transport:
// - RabbitMQ durable queue for replay and reliability.
// - Redis Pub/Sub fallback for low-latency best-effort fan-out.
void subscribeRoomEvents(async (event) => {
    await applyCrossNodeRoomEvent(event, "redis");
});

function startDurableRoomEventConsumer() {
    void subscribeDurableRoomEvents(NODE_ID, async (event) => {
        await applyCrossNodeRoomEvent(event, "rabbitmq");
    }).catch((error) => {
        console.error("[WS] Durable room event consumer unavailable; retrying", {
            delayMs: RABBITMQ_RETRY_DELAY_MS,
            error,
        });

        setTimeout(() => {
            startDurableRoomEventConsumer();
        }, RABBITMQ_RETRY_DELAY_MS).unref();
    });
}

const latestPersistedVersionByRoom = new Map<number, number>();

function startRoomPersistConsumer() {
    void subscribeRoomPersistJobs(async (job) => {
        const knownPersistedVersion = latestPersistedVersionByRoom.get(job.roomId) ?? 0;
        if (job.version <= knownPersistedVersion) {
            return;
        }

        await persistShapes(job.roomId, job.shapes);
        latestPersistedVersionByRoom.set(job.roomId, job.version);
    }).catch((error) => {
        console.error("[WS] Durable DB persist consumer unavailable; retrying", {
            delayMs: RABBITMQ_RETRY_DELAY_MS,
            error,
        });

        setTimeout(() => {
            startRoomPersistConsumer();
        }, RABBITMQ_RETRY_DELAY_MS).unref();
    });
}

startDurableRoomEventConsumer();
startRoomPersistConsumer();

wss.on("connection", function connection(ws: AuthenticatedWebSocket, request) {
    const authUser = checkUser(request);

    if (!authUser) {
        ws.close(1008, "Authentication failed");
        return;
    }

    const {userId, userName} = authUser;
    recordConnectionOpened();

    registerUser(userId, ws);
    ws.userName = userName ?? `User ${userId.slice(0, 6)}`;

    // Ping/pong for connection health.
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on("message", async (data) => {
        const bytes = typeof data === "string" ? Buffer.byteLength(data) : Buffer.byteLength(data as Buffer);
        recordInboundMessage(bytes);

        try {
            await handleSocketMessage(ws, userId, data);
        } catch (error) {
            console.error("Invalid message", error);
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Invalid message format",
                })
            );
        }
    });

    ws.on("close", () => {
        recordConnectionClosed();
        clearInterval(pingInterval);
        removeUserSocket(ws);

        if (ws.currentRoomId) {
            const roomId = ws.currentRoomId;
            const didUserFullyLeave = leaveActiveRoom(roomId, ws);

            if (didUserFullyLeave && ws.userId) {
                removeRoomPresence(roomId, ws.userId);
                broadcastRoomPresenceState(roomId);
            }
        }
    });

    ws.on("pong", () => {
        // Connection is alive.
    });
});
