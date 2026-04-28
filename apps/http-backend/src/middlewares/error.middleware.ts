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
function applyCircuitBreakerHeaders(res: Response, err: unknown) {
  const e = err as { code?: string; retryAfterMs?: number } | undefined;
  if (e?.code !== "DB_CIRCUIT_OPEN") {
    return;
  }

  const retryAfterMs = Number(e?.retryAfterMs ?? 0);
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
    );
  }
}

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) => {
  // Apply DB circuit header regardless of whether error is ApiError or unknown.
  applyCircuitBreakerHeaders(res, err);

  if (err instanceof ApiError) {
    // Known app/domain errors keep their explicit status and payload.
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  // Unknown errors are logged and normalized to 500.
  console.error("Unhandled API error:", err);

  const errorMsg = err as { message?: string } | undefined;
  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? (errorMsg?.message ?? "Internal Server Error")
        : "Internal Server Error",
  });
};
