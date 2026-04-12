import {WebSocket} from "ws";
import {JwtPayload} from "jsonwebtoken";

export interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    currentRoomId?: number;
}

export interface MyJwtPayload extends JwtPayload {
    userId: string;
}
