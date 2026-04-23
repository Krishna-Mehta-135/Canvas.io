/**
 * File intent:
 * Provide a shared async controller wrapper that normalizes thrown errors into
 * JSON responses and attaches resilience headers (for example Retry-After).
 */
import {NextFunction, Request, Response} from "express";

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Applies DB circuit-breaker response headers when present.
 *
 * The shared DB package throws `DB_CIRCUIT_OPEN` with a millisecond retry hint.
 * HTTP uses `Retry-After` in seconds, so conversion is done here.
 */
function applyCircuitBreakerHeaders(res: Response, error: any) {
    if (error?.code !== "DB_CIRCUIT_OPEN") {
        return;
    }

    const retryAfterMs = Number(error?.retryAfterMs ?? 0);
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
    }
}

/**
 * Wraps async route handlers so thrown errors are converted into JSON responses.
 *
 * Note: This handler sends the response directly rather than calling `next(err)`.
 * That is intentional in this codebase and keeps controller code concise.
 */
export const asyncHandler = (requestHandler: RequestHandler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await requestHandler(req, res, next);
        } catch (error: any) {
            // Attach Retry-After when DB circuit is open.
            applyCircuitBreakerHeaders(res, error);

            const statusCode =
                error.statusCode && error.statusCode >= 100 && error.statusCode <= 600 ? error.statusCode : 500;

            if (statusCode >= 500) {
                console.error("Error in asyncHandler:", error);
            } else {
                console.warn("Request error:", statusCode, error.message || "Unknown error");
            }

            // Uniform JSON error contract for all wrapped controllers.
            res.status(statusCode).json({
                success: false,
                message: error.message || "Internal Server Error",
            });
        }
    };
};
