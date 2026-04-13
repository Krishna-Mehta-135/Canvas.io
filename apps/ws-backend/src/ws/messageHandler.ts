import {RawData} from "ws";
import type {Shape} from "@repo/canvas-engine";
import type {ServerMessage, WsMessage} from "@repo/common";
import type {AuthenticatedWebSocket} from "./types.js";
import {broadcastToRoom, joinActiveRoom} from "./connectionState.js";
import {initializeRoomSync, persistShapes, roomSyncState} from "./roomSync.js";

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
        joinActiveRoom(roomId, ws);

        ws.send(
            JSON.stringify({
                type: "room_joined",
                roomId,
                version: roomState.version,
                shapes: roomState.shapes,
            } as ServerMessage)
        );
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
                console.warn(`[WS] Duplicate shape ID detected: ${shape.id}, will deduplicate server-side`);
            }
            shapeIds.add(shape.id);
        }

        try {
            await persistShapes(roomId, typedShapes);
        } catch (error) {
            console.error(`[WS] Failed to persist shapes for roomId ${roomId}:`, error);
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Failed to persist shapes to database",
                } as ServerMessage)
            );
            return;
        }

        roomState.version += 1;
        roomState.shapes = typedShapes;

        // Ack sender with the new authoritative room version.
        // Without this, sender can keep using a stale version and its next edit
        // may be rejected/resynced, causing visible rollback.
        ws.send(
            JSON.stringify({
                type: "room_joined",
                roomId,
                version: roomState.version,
                shapes: typedShapes,
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
