import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "./error.middleware";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

describe("error middleware", () => {
  it("should handle ApiError", () => {
    const err = new ApiError(400, "Bad Request");
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Bad Request",
      }),
    );
  });

  it("should handle generic Error as 500", () => {
    const err = new Error("Something went wrong");
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
