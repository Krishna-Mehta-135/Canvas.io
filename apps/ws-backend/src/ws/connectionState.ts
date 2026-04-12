import {WebSocket} from "ws";
import type {ServerMessage} from "@repo/common";
import type {AuthenticatedWebSocket} from "./types.js";

/**
 * userSockets
 *
 * Maps each connected userId to their WebSocket connections.
 * Map structure:
 * userId -> Set<WebSocket>
 */
export const userSockets = new Map<string, Set<AuthenticatedWebSocket>>();

/**
 * activeRooms
 *
 * Runtime in-memory structure that tracks which sockets
 * are currently subscribed to which rooms via WebSockets.
 *
 * Map structure:
 * roomId -> Set of sockets currently connected
 */
export const activeRooms = new Map<number, Set<AuthenticatedWebSocket>>();

export function registerUser(userId: string, ws: AuthenticatedWebSocket) {
    ws.userId = userId;

    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }

    userSockets.get(userId)?.add(ws);
}

export function removeUserSocket(ws: AuthenticatedWebSocket) {
    if (!ws.userId) return;

    const sockets = userSockets.get(ws.userId);
    if (!sockets) return;

    sockets.delete(ws);
    if (sockets.size === 0) {
        userSockets.delete(ws.userId);
    }
}

export function joinActiveRoom(roomId: number, ws: AuthenticatedWebSocket) {
    if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
    }

    activeRooms.get(roomId)?.add(ws);
    ws.currentRoomId = roomId;
}

export function leaveActiveRoom(roomId: number, ws: AuthenticatedWebSocket) {
    const roomSockets = activeRooms.get(roomId);
    if (!roomSockets) return;

    roomSockets.delete(ws);
    if (roomSockets.size === 0) {
        activeRooms.delete(roomId);
    }
}

export function broadcastToRoom(roomId: number, message: ServerMessage, senderWs: AuthenticatedWebSocket) {
    const roomSockets = activeRooms.get(roomId);
    if (!roomSockets) return;

    for (const socket of roomSockets) {
        if (socket === senderWs) continue;

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }
}
