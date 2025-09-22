import {WebSocketServer} from "ws";
import jwt from "jsonwebtoken"
import { JWT_SECRET } from "@repo/backend-common/config"

const wss = new WebSocketServer({port: 8080});

interface JWTPayload {
    userId: string;
    email: string;
}

wss.on("connection", function connection(ws, request) {
    const url = request.url  //ws://localhost:3000?token=123213
    
    if(!url){
        ws.close(1008, "URL required");
        return;
    }
    
    // Safe URL parsing
    const urlParts = url.split('?');
    if (urlParts.length < 2) {
        ws.close(1008, "Query parameters required");
        return;
    }
    
    const queryParameters = new URLSearchParams(urlParts[1]);
    const token = queryParameters.get("token") || ""

    if (!token) {
        ws.close(1008, "Token required");
        return;
    }

    if (!JWT_SECRET) {
        console.error("JWT_SECRET not found");
        ws.close(1011, "Server configuration error");
        return;
    }

    try {
        //we will only allow the user who is authenticated to enter into the ws
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    
        console.log(`User ${decoded.userId} connected`)
        ws.on("error", console.error);
    
        ws.on("message", function message(data) {
            console.log("received: %s", data);
        });
    
        ws.on("close", function close() {
            console.log(`User ${decoded.userId} disconnected`);
        });

        // Send welcome message
        ws.send(JSON.stringify({ 
            type: "connection", 
            message: "Connected successfully",
            userId: decoded.userId 
        }));
    }
    catch (error) {
        console.error("JWT verification failed:", error);
        ws.close(1008, "Invalid token");
        return;
    }
})

console.log("WebSocket server running on ws://localhost:8080");
