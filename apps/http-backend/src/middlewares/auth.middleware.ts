import {ApiResponse} from "../utils/ApiResponse";
import {asyncHandler} from "../utils/asyncHandler";
import {Request, Response, NextFunction} from "express";
import jwt from "jsonwebtoken";
import {JWT_SECRET} from "@repo/backend-common/config";
import {prisma} from "@repo/database";

// Define your custom JWT payload interface
interface CustomJWTPayload {
    userId: string;
    email: string;
}

// Define User type (based on your Prisma schema)
interface IUser {
    id: string;
    email: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            const token = req.headers.authorization.split(" ")[1];

            if (!JWT_SECRET || typeof JWT_SECRET !== "string") {
                throw new Error("JWT_SECRET is not properly configured");
            }

            if (!token) {
                return res.status(401).json(new ApiResponse(401, null, "No token provided."));
            }
            const decoded = jwt.verify(token, JWT_SECRET) as unknown as CustomJWTPayload;

            const user = await prisma.user.findUnique({
                where: {id: decoded.userId},
                select: {
                    id: true,
                    email: true,
                },
            });

            if (!user) {
                return res.status(401).json(new ApiResponse(401, null, "User not found"));
            }

            req.user = user;
            return next();
        } catch (error: any) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json(new ApiResponse(401, null, "Token expired. Please login again."));
            }
            if (error.name === "JsonWebTokenError") {
                return res.status(401).json(new ApiResponse(401, null, "Invalid token."));
            }
            return res.status(401).json(new ApiResponse(401, null, `Authentication failed: ${error.message}`));
        }
    } else {
        return res.status(401).json(new ApiResponse(401, null, "Not authorized. No token provided."));
    }
});

export {protect};
