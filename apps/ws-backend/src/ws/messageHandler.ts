import {RawData} from "ws";
import type {Shape} from "@repo/canvas-engine";
import type {ServerMessage, WsMessage} from "@repo/common";
import type {AuthenticatedWebSocket} from "./types.js";
import {
    broadcastRoomPresenceState,
    broadcastToRoom,
    getRoomPresenceState,
    joinActiveRoom,
    setRoomPresence,
} from "./connectionState.js";
import {initializeRoomSync, roomSyncState, scheduleRoomPersist} from "./roomSync.js";

export async function handleSocketMessage(ws: AuthenticatedWebSocket, userId: string, data: RawData) {
    const parsed = JSON.parse(data.toString()) as WsMessage;

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

        if (typeof roomId !== "number" || roomId <= 0) {
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Invalid roomId",
                } as ServerMessage)
            );
            return;
        }

        let roomState = roomSyncState.get(roomId);
        if (!roomState) {
            roomState = await initializeRoomSync(roomId);
        }

        if (version !== roomState.version) {
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

        scheduleRoomPersist(roomId, typedShapes);

        roomState.version += 1;
        roomState.shapes = typedShapes;

        // Ack sender with new authoritative version only to avoid
        // expensive full-state hydrate on every local edit.
        ws.send(
            JSON.stringify({
                type: "canvas_snapshot_ack",
                roomId,
                version: roomState.version,
            } as ServerMessage)
        );

        const broadcastMsg: ServerMessage = {
            type: "canvas_snapshot_broadcast",
            roomId,
            version: roomState.version,
            shapes: typedShapes,
            senderId: userId,
        };

        broadcastToRoom(roomId, broadcastMsg, ws);
    }
}
