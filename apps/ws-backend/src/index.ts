import {JWT_SECRET} from "@repo/backend-common/config";
import {WebSocketServer, WebSocket} from "ws";
import jwt, {JwtPayload} from "jsonwebtoken";
import {IncomingMessage} from "http";
import * as cookie from "cookie";
import {prismaClient} from "@repo/db/client";
import type {WsMessage, RoomSyncState, ServerMessage} from "@repo/common";
import type {Shape} from "@repo/canvas-engine";

interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    currentRoomId?: number;
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
 * userId -> Set<WebSocket>
 */
const userSockets = new Map<string, Set<AuthenticatedWebSocket>>();

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
 * roomId -> Set of sockets currently connected
 */
const activeRooms = new Map<number, Set<AuthenticatedWebSocket>>();

/**
 * roomSyncState
 * 
 * Per-room sync state: version number and current shapes.
 * Version increments on each accepted snapshot from clients.
 * Prevents collisions and enables explicit resync on mismatch.
 *
 * Map structure:
 * roomId -> RoomSyncState {version, shapes}
 */
const roomSyncState = new Map<number, RoomSyncState>();

function registerUser(userId: string, ws: AuthenticatedWebSocket) {
    ws.userId = userId;

    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }

    userSockets.get(userId)?.add(ws);
}

function joinActiveRoom(roomId: number, ws: AuthenticatedWebSocket) {
    if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
    }
    activeRooms.get(roomId)?.add(ws);
    ws.currentRoomId = roomId;
}

function leaveActiveRoom(roomId: number, ws: AuthenticatedWebSocket) {
    const roomSockets = activeRooms.get(roomId);
    if (roomSockets) {
        roomSockets.delete(ws);
        if (roomSockets.size === 0) {
            activeRooms.delete(roomId);
        }
    }
}

function broadcastToRoom(roomId: number, message: ServerMessage, senderWs: AuthenticatedWebSocket) {
    const roomSockets = activeRooms.get(roomId);
    if (!roomSockets) return;

    for (const socket of roomSockets) {
        if (socket === senderWs) continue;

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }
}

async function initializeRoomSync(roomId: number) {
    if (roomSyncState.has(roomId)) {
        return roomSyncState.get(roomId)!;
    }

    try {
        const shapes = await prismaClient.shape.findMany({
            where: {
                roomId,
                deleted: false,
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        const state: RoomSyncState = {
            roomId,
            version: 0,
            shapes: shapes.map((shape) => shape.props as Shape),
        };

        roomSyncState.set(roomId, state);
        return state;
    } catch (error) {
        console.error(`Failed to initialize room sync for roomId ${roomId}:`, error);
        throw error;
    }
}

async function persistShapes(roomId: number, shapes: Shape[]) {
    try {
        // Validate all shapes have required fields
        for (const shape of shapes) {
            if (!shape.id || typeof shape.id !== "string") {
                throw new Error("All shapes must have a valid string id");
            }
            if (!shape.type || typeof shape.type !== "string") {
                throw new Error("All shapes must have a valid string type");
            }
        }

        // Deduplicate shapes by ID (keep last occurrence)
        const uniqueShapesMap = new Map<string, Shape>();
        for (const shape of shapes) {
            uniqueShapesMap.set(shape.id, shape);
        }
        const uniqueShapes = Array.from(uniqueShapesMap.values());

        await prismaClient.$transaction(async (tx) => {
            // Delete all existing shapes for this room
            await tx.shape.deleteMany({
                where: {
                    roomId,
                },
            });

            // Create all new shapes in bulk
            if (uniqueShapes.length > 0) {
                await tx.shape.createMany({
                    data: uniqueShapes.map((shape) => ({
                        // Database id must be globally unique across all rooms.
                        // Keep client shape.id inside props unchanged for canvas logic.
                        id: `${roomId}:${shape.id}`,
                        roomId,
                        type: shape.type,
                        props: shape,
                        deleted: false,
                    })),
                    skipDuplicates: true,
                });
            }
        });
    } catch (error) {
        console.error(`Failed to persist shapes for roomId ${roomId}:`, error);
        throw error;
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

    // Ping/pong for connection health
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on("message", async function message(data) {
        try {
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

                // Initialize room sync state if not already done
                const roomState = await initializeRoomSync(roomId);
                joinActiveRoom(roomId, ws);

                // Send sync_init to joining user
                ws.send(
                    JSON.stringify({
                        type: "room_joined",
                        roomId,
                        version: roomState.version,
                        shapes: roomState.shapes,
                    } as ServerMessage)
                );
            } else if (parsed.type === "canvas_snapshot") {
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

                // Get or initialize room state
                let roomState = roomSyncState.get(roomId);
                if (!roomState) {
                    roomState = await initializeRoomSync(roomId);
                }

                // Check version match - if client version is stale, reject and resync
                if (version !== roomState.version) {
                    ws.send(
                        JSON.stringify({
                            type: "sync_error",
                            reason: `Version mismatch: client has ${version}, server has ${roomState.version}`,
                        } as ServerMessage)
                    );

                    // Push latest state to client
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

                // Validate shapes
                if (!Array.isArray(shapes)) {
                    ws.send(
                        JSON.stringify({
                            type: "sync_error",
                            reason: "Shapes must be an array",
                        } as ServerMessage)
                    );
                    return;
                }

                // Check for duplicate IDs
                const shapeIds = new Set<string>();
                for (const shape of shapes) {
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
                        console.warn(
                            `[WS] Duplicate shape ID detected: ${shape.id}, will deduplicate server-side`
                        );
                    }
                    shapeIds.add(shape.id);
                }

                console.log(
                    `[WS] Persisting ${shapes.length} shapes (${shapeIds.size} unique IDs) for roomId ${roomId}`
                );

                // Persist new shapes
                try {
                    await persistShapes(roomId, shapes);
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

                // Update room state
                roomState.version += 1;
                roomState.shapes = shapes;

                // Broadcast to all other users in room
                const broadcastMsg: ServerMessage = {
                    type: "canvas_snapshot_broadcast",
                    roomId,
                    version: roomState.version,
                    shapes,
                    senderId: userId,
                };

                broadcastToRoom(roomId, broadcastMsg, ws);
            }
        } catch (err) {
            console.error("Invalid message", err);
            ws.send(
                JSON.stringify({
                    type: "sync_error",
                    reason: "Invalid message format",
                } as ServerMessage)
            );
        }
    });

    ws.on("close", () => {
        clearInterval(pingInterval);

        if (!ws.userId) return;

        const sockets = userSockets.get(ws.userId);
        if (sockets) {
            sockets.delete(ws);
            if (sockets.size === 0) {
                userSockets.delete(ws.userId);
            }
        }

        if (ws.currentRoomId) {
            leaveActiveRoom(ws.currentRoomId, ws);
        }
    });

    ws.on("pong", () => {
        // Connection is alive
    });
});
