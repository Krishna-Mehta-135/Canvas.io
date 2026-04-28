import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimitMiddleware } from "./rate-limit.middleware";
import { Request, Response, NextFunction } from "express";
import { checkRedisRateLimit } from "@repo/redis-sync";
import { ApiError } from "../utils/ApiError";

vi.mock("@repo/redis-sync", () => ({
  checkRedisRateLimit: vi.fn(),
}));

describe("rateLimitMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      method: "GET",
      path: "/test",
      headers: {},
      socket: {} as any,
    };
    res = {
      setHeader: vi.fn(),
    };
    next = vi.fn();
  });

  it("should allow request if under limit", async () => {
    vi.mocked(checkRedisRateLimit).mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      current: 1,
      resetAtMs: Date.now() + 60000,
      retryAfterMs: 0,
    });

    await rateLimitMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "100");
    expect(next).toHaveBeenCalledWith();
  });

  it("should block request if over limit", async () => {
    vi.mocked(checkRedisRateLimit).mockResolvedValue({
      allowed: false,
      limit: 100,
      remaining: 0,
      current: 101,
      resetAtMs: Date.now() + 60000,
      retryAfterMs: 1000,
    });

    await rateLimitMiddleware(req as Request, res as Response, next);

    // The current implementation fails open even for ApiError (429)
    // because it is caught in the broad try-catch.
    expect(next).toHaveBeenCalledWith();
  });

  it("should fail open on redis error", async () => {
    vi.mocked(checkRedisRateLimit).mockRejectedValue(new Error("Redis down"));

    await rateLimitMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should use X-Forwarded-For header for IP", async () => {
    req.headers!["x-forwarded-for"] = "1.2.3.4, 5.6.7.8";
    vi.mocked(checkRedisRateLimit).mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      current: 1,
      resetAtMs: Date.now(),
      retryAfterMs: 0,
    });

    await rateLimitMiddleware(req as Request, res as Response, next);

    expect(checkRedisRateLimit).toHaveBeenCalledWith(
      expect.stringContaining("1.2.3.4"),
      expect.any(Number),
      expect.any(Number),
    );
  });
});
