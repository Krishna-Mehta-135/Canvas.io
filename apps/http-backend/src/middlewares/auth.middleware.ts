import jwt from "jsonwebtoken";
import {NextFunction, Request, Response} from "express";
import {ApiError} from "../utils/ApiError";
import {JWT_SECRET} from "@repo/backend-common/config";

import {verifyToken} from "../utils/token";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const accessToken = req.cookies?.accessToken;

        if (!accessToken) {
            throw new ApiError(401, "Access token missing");
        }

        const decoded = verifyToken(accessToken);

        if (decoded.type !== "access") {
            throw new ApiError(401, "Invalid token type");
        }

        req.userId = decoded.userId;
        next();
    } catch (error) {
        if (error instanceof ApiError) {
            return next(error);
        }

        return next(new ApiError(401, "Unauthorized"));
    }
}
