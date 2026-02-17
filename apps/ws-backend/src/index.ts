import { JWT_SECRET } from '@repo/backend-common/config';
import { WebSocketServer, WebSocket } from 'ws';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
}

interface MyJwtPayload extends JwtPayload {
    userId: string;
}


if(!JWT_SECRET){
    throw new Error("JWT_SECRET is not defined");
}

const wss = new WebSocketServer({port: 8080})

wss.on("connection", function connection(ws:AuthenticatedWebSocket, request){
    try {
        const url = request.url;
        if(!url){
            ws.close(1008, "Missing URL")
            return
        }

        const queryParams = new URLSearchParams(url.split("?")[1])
        const token = queryParams.get("token")

        if(!token){
            ws.close(1008, "Token required");
            return;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as MyJwtPayload

        if(!decoded.userId){
            ws.close(1008, "Invalid token")
            return
        }

        ws.userId = decoded.userId

        ws.on("message", function message(data){
            ws.send("pong")
        })
    } catch (error) {
        ws.close(1008, "Authentication failed")
    }
})