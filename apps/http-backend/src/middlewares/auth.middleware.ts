import jwt from "jsonwebtoken";
import {NextFunction, Request, Response} from "express";
import {ApiError} from "../utils/ApiError";
import {JWT_SECRET} from "../config";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

interface CustomJwtPayload {
    userId: string;
}

function isCustomJwtPayload(decoded: unknown): decoded is CustomJwtPayload {
    return (
        typeof decoded === "object" &&
        decoded !== null &&
        "userId" in decoded &&
        typeof (decoded as any).userId === "string"
    );
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            throw new ApiError(401, "Authorization token missing");
        }

        const parts = authHeader.split(" ");

        if (parts.length !== 2) {
            throw new ApiError(401, "Invalid authorization header format");
        }

        const token: string = parts[1] as string;

        const decoded = jwt.verify(token, JWT_SECRET);

        if (!isCustomJwtPayload(decoded)) {
            throw new ApiError(401, "Invalid token payload");
        }

        req.userId = decoded.userId;

        next();
    } catch (error) {
        next(error);
    }
}
