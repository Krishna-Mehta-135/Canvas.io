import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyToken } from "../utils/token";
import { prismaClient } from "@repo/db/client";

declare module "express" {
  interface Request {
    userId?: string;
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      throw new ApiError(401, "Access token missing");
    }

    const decoded = verifyToken(accessToken);

    if (decoded.type !== "access") {
      throw new ApiError(401, "Invalid token type");
    }

    // Verify token version hasn't been revoked
    const user = await prismaClient.user.findUnique({
      where: { id: decoded.userId },
      select: { tokenVersion: true },
    });

    if (!user || (user.tokenVersion ?? 0) !== decoded.tokenVersion) {
      throw new ApiError(401, "Token has been revoked");
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

    return next(new ApiError(401, "Unauthorized"));
  }
}
