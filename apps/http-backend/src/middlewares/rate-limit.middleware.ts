/**
 * File intent:
 * Enforce HTTP request quotas consistently across instances using Redis-backed
 * fixed-window counters while exposing standard rate-limit headers.
 */
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { checkRedisRateLimit } from "@repo/redis-sync";

// HTTP route-level fixed-window limiter defaults.
const WINDOW_MS = Number(process.env.HTTP_RATE_LIMIT_WINDOW_MS ?? "60000");
const MAX_REQUESTS = Number(process.env.HTTP_RATE_LIMIT_MAX_REQUESTS ?? "120");

/**
 * Resolves a stable client IP for rate-limit bucketing.
 *
 * Priority:
 * 1) first IP from X-Forwarded-For (when behind proxy/load balancer)
 * 2) Express socket-derived IP fallback
 */
function getClientIp(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    const firstForwardedFor = forwardedFor.split(",")[0];
    if (firstForwardedFor) {
      return firstForwardedFor.trim();
    }
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const firstForwardedFor = forwardedFor[0];
    if (firstForwardedFor) {
      return firstForwardedFor.trim();
    }
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Builds a route key independent of specific actor identity.
 *
 * The actor segment is appended later so different users/IPs do not share
 * the same quota bucket.
 */
function getRouteKey(req: Request) {
  return `${req.method}:${req.baseUrl || ""}:${req.path}`;
}

/**
 * Redis-backed rate-limit middleware.
 *
 * Behavior:
 * - skip OPTIONS for CORS preflight compatibility
 * - compute actor-aware bucket key (authenticated user preferred, IP fallback)
 * - ask Redis for quota decision and expose standard X-RateLimit headers
 * - on quota breach, return 429 with Retry-After
 * - on Redis failure, fail open to preserve API availability
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "OPTIONS") {
    return next();
  }

  const actor = req.userId || getClientIp(req);
  const routeKey = `${getRouteKey(req)}:${actor}`;

  try {
    // Atomic Redis check (INCR + TTL) keeps buckets consistent across instances.
    const limitResult = await checkRedisRateLimit(
      routeKey,
      MAX_REQUESTS,
      WINDOW_MS,
    );
    res.setHeader("X-RateLimit-Limit", String(limitResult.limit));
    res.setHeader("X-RateLimit-Remaining", String(limitResult.remaining));
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(limitResult.resetAtMs / 1000)),
    );

    if (!limitResult.allowed) {
      // Retry-After expects seconds, not milliseconds.
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil(limitResult.retryAfterMs / 1000))),
      );
      throw new ApiError(429, "Too many requests");
    }
  } catch (error) {
    // Deliberately fail open when Redis is unavailable.
    // Availability is prioritized here because circuit breaker + DB protections
    // still guard core data paths from overload cascades.
    console.warn(
      "[rate-limit] Redis rate limit check failed; allowing request",
      {
        routeKey,
        error: error instanceof Error ? error.message : error,
      },
    );
  }

  return next();
}
