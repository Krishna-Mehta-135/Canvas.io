import { describe, it, expect, vi, beforeEach } from "vitest";
import { idempotencyMiddleware } from "./idempotency.middleware";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import EventEmitter from "node:events";

describe("idempotencyMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      method: "POST",
      path: "/test",
      header: vi.fn(),
      body: { foo: "bar" },
      headers: {},
      socket: {} as any,
    };
    const resEmitter = new EventEmitter();
    res = Object.assign(resEmitter, {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      set: vi.fn(),
      getHeaders: vi.fn().mockReturnValue({}),
      statusCode: 200,
    }) as any;
    next = vi.fn();
  });

  it("should pass through if no idempotency key is provided", async () => {
    vi.mocked(req.header as any).mockReturnValue(undefined);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("should cache and replay response for same key and payload", async () => {
    vi.mocked(req.header as any).mockReturnValue("key-1");

    // First call
    const firstCallNext = vi.fn(() => {
      (res as any).statusCode = 201;
      res.json!({ result: "ok" });
      (res as any).emit("finish");
    });
    await idempotencyMiddleware(req as Request, res as Response, firstCallNext);
    expect(firstCallNext).toHaveBeenCalled();

    // Second call with same key
    const res2 = new EventEmitter() as any;
    res2.status = vi.fn().mockReturnThis();
    res2.json = vi.fn().mockReturnThis();
    res2.set = vi.fn().mockReturnThis();

    const next2 = vi.fn();
    await idempotencyMiddleware(req as Request, res2 as Response, next2);

    expect(next2).not.toHaveBeenCalled();
    expect(res2.status).toHaveBeenCalledWith(201);
    expect(res2.json).toHaveBeenCalledWith({ result: "ok" });
  });

  it("should return 409 if same key is used with different payload", async () => {
    vi.mocked(req.header as any).mockReturnValue("key-1");

    // First call
    await idempotencyMiddleware(req as Request, res as Response, () => {
      res.json!({ result: "ok" });
      (res as any).emit("finish");
    });

    // Second call with different body
    const req2 = { ...req, body: { different: "payload" } } as Request;
    const res2 = new EventEmitter() as any;
    res2.status = vi.fn().mockReturnThis();
    res2.json = vi.fn().mockReturnThis();

    await expect(
      idempotencyMiddleware(req2 as Request, res2 as Response, vi.fn()),
    ).rejects.toThrow(ApiError);
  });

  it("should handle non-replayable status (500)", async () => {
    vi.mocked(req.header as any).mockReturnValue("key-error");

    await idempotencyMiddleware(req as Request, res as Response, () => {
      (res as any).statusCode = 500;
      res.json!({ error: "fail" });
      (res as any).emit("finish");
    });

    // Key should have been deleted from store, so next call should not find it
    const next2 = vi.fn();
    await idempotencyMiddleware(req as Request, res as Response, next2);
    expect(next2).toHaveBeenCalled();
  });

  it("should handle res.send body kind", async () => {
    vi.mocked(req.header as any).mockReturnValue("key-send");

    await idempotencyMiddleware(req as Request, res as Response, () => {
      res.send!("plain text");
      (res as any).emit("finish");
    });

    const res2 = new EventEmitter() as any;
    res2.status = vi.fn().mockReturnThis();
    res2.send = vi.fn().mockReturnThis();
    res2.set = vi.fn().mockReturnThis();

    await idempotencyMiddleware(req as Request, res2 as Response, vi.fn());
    expect(res2.send).toHaveBeenCalledWith("plain text");
  });

  it("should handle res.end body kind", async () => {
    vi.mocked(req.header as any).mockReturnValue("key-end");

    await idempotencyMiddleware(req as Request, res as Response, () => {
      res.end!("end buffer");
      (res as any).emit("finish");
    });

    const res2 = new EventEmitter() as any;
    res2.status = vi.fn().mockReturnThis();
    res2.end = vi.fn().mockReturnThis();
    res2.set = vi.fn().mockReturnThis();

    await idempotencyMiddleware(req as Request, res2 as Response, vi.fn());
    expect(res2.end).toHaveBeenCalledWith("end buffer");
  });

  it("should handle client closed before response (499)", async () => {
    vi.mocked(req.header as any).mockReturnValue("key-close");

    await idempotencyMiddleware(req as Request, res as Response, () => {
      (res as any).writableEnded = false;
      (res as any).emit("close");
    });

    // Should be able to retry since it wasn't cached
    const next2 = vi.fn();
    await idempotencyMiddleware(req as Request, res as Response, next2);
    expect(next2).toHaveBeenCalled();
  });
});
