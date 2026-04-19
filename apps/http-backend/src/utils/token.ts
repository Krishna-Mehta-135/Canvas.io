import jwt from "jsonwebtoken";
import {JWT_SECRET} from "@repo/backend-common/config";
import {ApiError} from "./ApiError";

export interface TokenPayload {
    userId: string;
    name: string;
    tokenVersion: number;
    type: "access" | "refresh";
}

/**
 * Generates an access token (short-lived, 15 minutes)
 */
export const generateAccessToken = (
    userId: string,
    name: string,
    tokenVersion: number
): string => {
    if (!JWT_SECRET) {
        throw new ApiError(500, "JWT_SECRET is not defined");
    }

    return jwt.sign(
        {
            userId,
            name,
            tokenVersion,
            type: "access",
        },
        JWT_SECRET,
        {
            expiresIn: "15m",
        }
    );
};

/**
 * Generates a refresh token (long-lived, 7 days)
 */
export const generateRefreshToken = (
    userId: string,
    name: string,
    tokenVersion: number
): string => {
    if (!JWT_SECRET) {
        throw new ApiError(500, "JWT_SECRET is not defined");
    }

    return jwt.sign(
        {
            userId,
            name,
            tokenVersion,
            type: "refresh",
        },
        JWT_SECRET,
        {
            expiresIn: "7d",
        }
    );
};

/**
 * Verifies and decodes a token
 */
export const verifyToken = (token: string): TokenPayload => {
    if (!JWT_SECRET) {
        throw new ApiError(500, "JWT_SECRET is not defined");
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        const isValidPayload =
            typeof decoded?.userId === "string" &&
            typeof decoded?.name === "string" &&
            typeof decoded?.tokenVersion === "number" &&
            (decoded?.type === "access" || decoded?.type === "refresh");

        if (!isValidPayload) {
            throw new ApiError(401, "Invalid token payload");
        }

        return decoded as TokenPayload;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new ApiError(401, "Token has expired");
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new ApiError(401, "Invalid token");
        }
        throw error;
    }
};
