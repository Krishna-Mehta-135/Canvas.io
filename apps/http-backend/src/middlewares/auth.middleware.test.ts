import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticate } from "./auth.middleware";
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/token";
import { ApiError } from "../utils/ApiError";

vi.mock("../utils/token", () => ({
  verifyToken: vi.fn(),
}));

describe("authenticate middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      cookies: {},
    };
    res = {};
    next = vi.fn();
  });

  it("should authenticate successfully with a valid access token", () => {
    req.cookies!.accessToken = "valid-token";
    vi.mocked(verifyToken).mockReturnValue({
      userId: "user-123",
      name: "John Doe",
      tokenVersion: 1,
      type: "access",
    });

    authenticate(req as Request, res as Response, next);

    expect(verifyToken).toHaveBeenCalledWith("valid-token");
    expect(req.userId).toBe("user-123");
    expect(next).toHaveBeenCalledWith();
  });

  it("should throw 401 if access token is missing", () => {
    authenticate(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = vi.mocked(next).mock.calls[0]?.[0] as unknown as ApiError;
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Access token missing");
  });

  it('should throw 401 if token type is not "access"', () => {
    req.cookies!.accessToken = "refresh-token";
    vi.mocked(verifyToken).mockReturnValue({
      userId: "user-123",
      name: "John Doe",
      tokenVersion: 1,
      type: "refresh",
    });

    authenticate(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = vi.mocked(next).mock.calls[0]?.[0] as unknown as ApiError;
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Invalid token type");
  });

  it("should handle verifyToken errors and return 401", () => {
    req.cookies!.accessToken = "invalid-token";
    vi.mocked(verifyToken).mockImplementation(() => {
      throw new ApiError(401, "Invalid token");
    });

    authenticate(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = vi.mocked(next).mock.calls[0]?.[0] as unknown as ApiError;
    expect(error.statusCode).toBe(401);
  });
});
