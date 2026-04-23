/**
 * File intent:
 * Final Express error boundary for requests not already handled by asyncHandler,
 * with support for resilience headers such as DB circuit-breaker Retry-After.
 */
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Adds HTTP backoff hints for shared DB circuit-breaker failures.
 */
function applyCircuitBreakerHeaders(res: Response, err: any) {
    if (err?.code !== "DB_CIRCUIT_OPEN") {
        return;
    }

    const retryAfterMs = Number(err?.retryAfterMs ?? 0);
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
    }
}

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Apply DB circuit header regardless of whether error is ApiError or unknown.
    applyCircuitBreakerHeaders(res, err);

    if(err instanceof ApiError){
        // Known app/domain errors keep their explicit status and payload.
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors
        })
    }

    // Unknown errors are logged and normalized to 500.
    console.error("Unhandled API error:", err);

    return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "development" ? err?.message || "Internal Server Error" : "Internal Server Error"
    });
}