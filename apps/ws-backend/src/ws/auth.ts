import { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import * as cookie from "cookie";
import { JWT_SECRET } from "@repo/backend-common/config";
import { MyJwtPayload } from "./types.js";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

export function checkUser(request: IncomingMessage) {
  // 1. Try query param token first (mobile Safari cookie workaround)
  const url = new URL(request.url ?? "/", "http://localhost");
  const queryToken = url.searchParams.get("token");

  if (queryToken) {
    try {
      const decoded = jwt.verify(queryToken, JWT_SECRET) as MyJwtPayload;
      if (decoded.userId && decoded.type === "ws-handshake") {
        return {
          userId: decoded.userId,
          userName: decoded.name ?? null,
        };
      }
    } catch {
      // If query token is present but invalid, we don't fall back to cookies.
      return null;
    }
  }

  // 2. Fall back to cookie (desktop)
  const cookies = cookie.parse(request.headers.cookie || "");
  const token = cookies.accessToken;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
    if (!decoded.userId || decoded.type !== "access") {
      return null;
    }

    return {
      userId: decoded.userId,
      userName: decoded.name ?? null,
    };
  } catch {
    return null;
  }
}
