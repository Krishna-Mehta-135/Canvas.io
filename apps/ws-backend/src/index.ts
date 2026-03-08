import {JWT_SECRET} from "@repo/backend-common/config";
import {WebSocketServer, WebSocket} from "ws";
import jwt, {JwtPayload} from "jsonwebtoken";
import {IncomingMessage} from "http";
import * as cookie from "cookie";
import {prismaClient} from "@repo/db/client";

interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
}

interface MyJwtPayload extends JwtPayload {
    userId: string;
}

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
}
/**
 * userSockets
 *
 * Maps each connected userId to their WebSocket connection.
 * Used to send realtime messages to a specific user.
 *
 * Map structure:
 * userId -> WebSocket
 */
const userSockets = new Map<string, AuthenticatedWebSocket>();

/**
 * activeRooms
 *
 * Runtime in-memory structure that tracks which users
 * are currently subscribed to which rooms via WebSockets.
 *
 * This does NOT represent rooms stored in the database.
 * Database rooms are stored in the Room table.
 *
 * Map structure:
 * roomId -> Set of userIds currently connected
 */
const activeRooms = new Map<number, Set<string>>();

function registerUser(userId: string, ws: AuthenticatedWebSocket) {
    ws.userId = userId;
    userSockets.set(userId, ws);
}

function joinActiveRoom(userId: string, roomId: number) {
    if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
    }

    activeRooms.get(roomId)?.add(userId);
}

function broadcastToRoom(roomId: number, message: string, senderId: string) {
    const roomUsers = activeRooms.get(roomId);

    if (!roomUsers) return;

    for (const userId of roomUsers) {
        if (userId === senderId) continue;

        const socket = userSockets.get(userId);

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(
                JSON.stringify({
                    type: "chat",
                    roomId,
                    message,
                    senderId,
                })
            );
        }
    }
}

const checkUser = (request: IncomingMessage) => {
    const cookies = cookie.parse(request.headers.cookie || "");
    const token = cookies.token;

    if (!token) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
        return decoded.userId || null;
    } catch (error) {
        return null;
    }
};

const wss = new WebSocketServer({port: 8080});

wss.on("connection", function connection(ws: AuthenticatedWebSocket, request) {
    const userId = checkUser(request);

    if (!userId) {
        ws.close(1008, "Authentication failed");
        return;
    }

    registerUser(userId, ws);

    ws.on("message", async function message(data) {
        try {
            const parsed = JSON.parse(data.toString());

            if (parsed.type === "join_room") {
                joinActiveRoom(userId, parsed.roomId);
                if (parsed.type === "join_room") {
                    joinActiveRoom(userId, parsed.roomId);

                    ws.send(
                        JSON.stringify({
                            type: "joined_room",
                            roomId: parsed.roomId,
                        })
                    );
                }
            }

            if (parsed.type === "chat" && parsed.roomId && parsed.message) {
                await prismaClient.chat.create({
                    data: {
                        roomId: parsed.roomId,
                        userId: userId,
                        message: parsed.message,
                    },
                });
                broadcastToRoom(parsed.roomId, parsed.message, userId);
            }
        } catch (err) {
            console.error("Invalid message", err);
        }
    });

    ws.on("close", () => {
        if (!ws.userId) return;
        userSockets.delete(ws.userId);

        for (const [roomId, users] of activeRooms.entries()) {
            users.delete(ws.userId);

            if (users.size === 0) {
                activeRooms.delete(roomId);
            }
        }
    });
});
