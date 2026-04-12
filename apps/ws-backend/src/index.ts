import {WebSocketServer, WebSocket} from "ws";
import {checkUser} from "./ws/auth.js";
import {leaveActiveRoom, registerUser, removeUserSocket} from "./ws/connectionState.js";
import {handleSocketMessage} from "./ws/messageHandler.js";
import type {AuthenticatedWebSocket} from "./ws/types.js";

const wss = new WebSocketServer({port: 8080});

wss.on("connection", function connection(ws: AuthenticatedWebSocket, request) {
    const userId = checkUser(request);

    if (!userId) {
        ws.close(1008, "Authentication failed");
        return;
    }

    registerUser(userId, ws);

    // Ping/pong for connection health.
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on("message", async (data) => {
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
        clearInterval(pingInterval);
        removeUserSocket(ws);

        if (ws.currentRoomId) {
            leaveActiveRoom(ws.currentRoomId, ws);
        }
    });

    ws.on("pong", () => {
        // Connection is alive.
    });
});
