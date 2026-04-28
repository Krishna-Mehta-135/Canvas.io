import { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import * as cookie from "cookie";
import { JWT_SECRET } from "@repo/backend-common/config";
import { MyJwtPayload } from "./types.js";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

export function checkUser(request: IncomingMessage) {
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
