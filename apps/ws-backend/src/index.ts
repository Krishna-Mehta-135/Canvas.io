import "@repo/backend-common/config";
import {WebSocketServer, WebSocket} from "ws";
import {checkUser} from "./ws/auth.js";
import {
    broadcastRoomPresenceState,
    broadcastToRoomAll,
    leaveActiveRoom,
    registerUser,
    removeRoomPresence,
    removeUserSocket,
} from "./ws/connectionState.js";
import {handleSocketMessage} from "./ws/messageHandler.js";
import {cacheRoomSyncState} from "./ws/roomSync.js";
import {NODE_ID, subscribeRoomEvents} from "@repo/redis-sync";
import type {AuthenticatedWebSocket} from "./ws/types.js";
import type {ServerMessage} from "@repo/common";
import {
    recordConnectionClosed,
    recordConnectionOpened,
    recordInboundMessage,
    recordRedisFanoutEvent,
    startMetricsReporter,
} from "./ws/metrics.js";

const wss = new WebSocketServer({port: 8080});

console.log("WebSocket server online on port 8080");
startMetricsReporter();

// Redis Pub/Sub is the cross-node distribution layer. Each WS process still
// owns its local sockets, but all processes observe the same room events.
void subscribeRoomEvents(async (event) => {
    if (event.originNodeId === NODE_ID) {
        // The originating node already handled the local socket update.
        return;
    }

    recordRedisFanoutEvent();

    cacheRoomSyncState({
        roomId: event.roomId,
        version: event.version,
        shapes: event.shapes,
    });

    const message: ServerMessage = {
        type: event.type,
        roomId: event.roomId,
        version: event.version,
        shapes: event.shapes,
        senderId: event.senderId ?? "unknown",
    };

    // Forward the Redis event to the local clients currently joined to this room.
    broadcastToRoomAll(event.roomId, message);
});

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
