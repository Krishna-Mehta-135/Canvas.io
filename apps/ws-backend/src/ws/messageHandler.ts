import {RawData} from "ws";
import type {Shape} from "@repo/canvas-engine";
import {ClientWsMessageSchema} from "@repo/common/ws-protocol";
import type {ServerMessage} from "@repo/common";
import {prismaClient} from "@repo/db/client";
import type {AuthenticatedWebSocket} from "./types.js";
import {
    broadcastRoomPresenceState,
    broadcastToRoom,
    getRoomPresenceState,
    joinActiveRoom,
    setRoomPresence,
} from "./connectionState.js";
import {cacheRoomSyncState, initializeRoomSync, scheduleRoomPersist} from "./roomSync.js";
import {commitRoomSnapshot, getRoomVersion, NODE_ID} from "@repo/redis-sync";
import {
    recordInvalidJsonPayload,
    recordInvalidMessagePayload,
    recordOversizedMessage,
    recordRateLimitedSnapshot,
    recordSnapshotCommitFailure,
    recordSnapshotCommitted,
    recordVersionMismatch,
} from "./metrics.js";

const WS_MAX_MESSAGE_BYTES = Number(process.env.WS_MAX_MESSAGE_BYTES ?? 512 * 1024);
const WS_SNAPSHOT_RATE_LIMIT_COUNT = Number(process.env.WS_SNAPSHOT_RATE_LIMIT_COUNT ?? 30);
const WS_SNAPSHOT_RATE_LIMIT_WINDOW_MS = Number(process.env.WS_SNAPSHOT_RATE_LIMIT_WINDOW_MS ?? 1000);

const snapshotRateWindowBySocket = new WeakMap<AuthenticatedWebSocket, {windowStartMs: number; count: number}>();

function rawDataByteLength(data: RawData) {
    if (typeof data === "string") {
        return Buffer.byteLength(data);
    }

    if (Array.isArray(data)) {
        return data.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    }

    if (data instanceof ArrayBuffer) {
        return data.byteLength;
    }

    return Buffer.byteLength(data);
}

function isSnapshotRateLimited(ws: AuthenticatedWebSocket) {
    const now = Date.now();
    const existing = snapshotRateWindowBySocket.get(ws);

    if (!existing || now - existing.windowStartMs >= WS_SNAPSHOT_RATE_LIMIT_WINDOW_MS) {
        snapshotRateWindowBySocket.set(ws, {
            windowStartMs: now,
            count: 1,
        });
        return false;
    }

    existing.count += 1;
    return existing.count > WS_SNAPSHOT_RATE_LIMIT_COUNT;
}

async function hasOwnerRoomAccess(roomId: number, userId: string) {
    const room = await prismaClient.room.findFirst({
        where: {
            id: roomId,
            adminId: userId,
        },
        select: {
            id: true,
        },
    });

    return Boolean(room);
}

function rejectForbidden(ws: AuthenticatedWebSocket) {
    ws.send(
        JSON.stringify({
            type: "sync_error",
            reason: "Forbidden",
        } as ServerMessage)
    );

    ws.close(1008, "Forbidden");
}

export async function handleSocketMessage(ws: AuthenticatedWebSocket, userId: string, data: RawData) {
    const payloadBytes = rawDataByteLength(data);
    if (payloadBytes > WS_MAX_MESSAGE_BYTES) {
        recordOversizedMessage();
        ws.send(
            JSON.stringify({
                type: "sync_error",
                reason: "Payload exceeds maximum allowed size",
            } as ServerMessage)
        );
        return;
    }

    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(data.toString());
    } catch {
        recordInvalidJsonPayload();
        ws.send(
            JSON.stringify({
                type: "sync_error",
                reason: "Invalid JSON payload",
            } as ServerMessage)
        );
        return;
    }

    const messageValidation = ClientWsMessageSchema.safeParse(parsedJson);
    if (!messageValidation.success) {
        recordInvalidMessagePayload();
        ws.send(
            JSON.stringify({
                type: "sync_error",
                reason: "Invalid message payload",
            } as ServerMessage)
        );
        return;
    }

    const parsed = messageValidation.data;

    if (parsed.type === "join_room") {
        const roomId = parsed.roomId;

        if (typeof roomId !== "number" || roomId <= 0) {
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Invalid roomId",
                } as ServerMessage)
            );
            return;
        }

        const hasAccess = await hasOwnerRoomAccess(roomId, userId);
        if (!hasAccess) {
            rejectForbidden(ws);
            return;
        }

        const roomState = await initializeRoomSync(roomId);
        const isFirstRoomConnectionForUser = joinActiveRoom(roomId, ws);

        if (isFirstRoomConnectionForUser && ws.userId) {
            setRoomPresence(roomId, ws.userId, {
                userId: ws.userId,
                userName: ws.userName ?? `User ${ws.userId.slice(0, 6)}`,
                cursor: null,
                selectedIds: [],
                tool: null,
            });
        }

        const presenceState = getRoomPresenceState(roomId);

        ws.send(
            JSON.stringify({
                type: "room_joined",
                roomId,
                version: roomState.version,
                shapes: roomState.shapes,
                userId,
                connectedUsersCount: presenceState.connectedUsersCount,
                presences: presenceState.presences,
            } as ServerMessage)
        );

        broadcastRoomPresenceState(roomId);
        return;
    }

    if (parsed.type === "update_presence") {
        const {roomId, cursor, selectedIds} = parsed;

        if (typeof roomId !== "number" || roomId <= 0) {
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Invalid roomId",
                } as ServerMessage)
            );
            return;
        }

        if (!ws.currentRoomId) {
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Forbidden",
                } as ServerMessage)
            );
            return;
        }

        if (ws.currentRoomId !== roomId) {
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Presence update sent for a room that is not active",
                } as ServerMessage)
            );
            return;
        }

        if (!ws.userId) {
            return;
        }

        setRoomPresence(roomId, ws.userId, {
            userId: ws.userId,
            userName: ws.userName ?? `User ${ws.userId.slice(0, 6)}`,
            cursor: null,
            selectedIds: Array.isArray(selectedIds) ? selectedIds : [],
            tool: typeof parsed.tool === "string" ? parsed.tool : null,
        });

        broadcastRoomPresenceState(roomId);
        return;
    }

    if (parsed.type === "canvas_snapshot") {
        const {roomId, version, shapes} = parsed;

        if (isSnapshotRateLimited(ws)) {
            recordRateLimitedSnapshot();
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Snapshot rate limit exceeded. Slow down and retry.",
                } as ServerMessage)
            );
            return;
        }

        if (typeof roomId !== "number" || roomId <= 0) {
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Invalid roomId",
                } as ServerMessage)
            );
            return;
        }

        if (ws.currentRoomId !== roomId) {
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Forbidden",
                } as ServerMessage)
            );
            return;
        }

        // Redis is the source of truth for the version. If the client is behind,
        // we send the authoritative snapshot so it can resync without guessing.
        const authoritativeVersion = await getRoomVersion(roomId);
        if (version !== authoritativeVersion) {
            recordVersionMismatch();
            const roomState = await initializeRoomSync(roomId);
            const presenceState = getRoomPresenceState(roomId);

            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: `Version mismatch: client has ${version}, server has ${authoritativeVersion}`,
                } as ServerMessage)
            );

            ws.send(
                JSON.stringify({
                    type: "room_joined",
                    roomId,
                    version: roomState.version,
                    shapes: roomState.shapes,
                    userId,
                    connectedUsersCount: presenceState.connectedUsersCount,
                    presences: presenceState.presences,
                } as ServerMessage)
            );
            return;
        }

        if (!Array.isArray(shapes)) {
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Shapes must be an array",
                } as ServerMessage)
            );
            return;
        }

        const typedShapes = shapes as Shape[];
        const shapeIds = new Set<string>();
        for (const shape of typedShapes) {
            if (typeof shape.id !== "string") {
                ws.send(
                    JSON.stringify({
                        type: "sync_error",
                        reason: "All shapes must have string IDs",
                    } as ServerMessage)
                );
                return;
            }

            if (shapeIds.has(shape.id)) {
                // Deduplicate silently server-side.
            }
            shapeIds.add(shape.id);
        }

        // The commit is atomic in Redis: version bump, snapshot replacement, and
        // cross-node publish all happen as one room transition.
        const nextVersion = await commitRoomSnapshot(roomId, version, typedShapes, {
            originNodeId: NODE_ID,
            senderId: userId,
        });

        if (!nextVersion) {
            recordSnapshotCommitFailure();
            const roomState = await initializeRoomSync(roomId);
            const presenceState = getRoomPresenceState(roomId);

            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: `Version mismatch: client has ${version}, server has ${roomState.version}`,
                } as ServerMessage)
            );

            ws.send(
                JSON.stringify({
                    type: "room_joined",
                    roomId,
                    version: roomState.version,
                    shapes: roomState.shapes,
                    userId,
                    connectedUsersCount: presenceState.connectedUsersCount,
                    presences: presenceState.presences,
                } as ServerMessage)
            );
            return;
        }

        recordSnapshotCommitted();

        scheduleRoomPersist(roomId, typedShapes);
        cacheRoomSyncState({
            roomId,
            version: nextVersion,
            shapes: typedShapes,
        });

        // Ack sender with new authoritative version only to avoid
        // expensive full-state hydrate on every local edit.
        ws.send(
            JSON.stringify({
                type: "canvas_snapshot_ack",
                roomId,
                version: nextVersion,
            } as ServerMessage)
        );

        const broadcastMsg: ServerMessage = {
            type: "canvas_snapshot_broadcast",
            roomId,
            version: nextVersion,
            shapes: typedShapes,
            senderId: userId,
        };

        broadcastToRoom(roomId, broadcastMsg, ws);
    }
}
