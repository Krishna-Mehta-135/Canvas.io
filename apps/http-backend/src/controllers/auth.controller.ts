import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { CreateUserSchema, SignInUserSchema } from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import { comparePassword, hashPassword } from "../utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "../utils/token";
import { getCookieOptions } from "../utils/cookie";
import jwt from "jsonwebtoken";
import { JWT_SECRET, WEB_APP_URL } from "@repo/backend-common/config";
import { sendPasswordResetEmail } from "../utils/email";

const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";

function authDebug(message: string, meta?: Record<string, unknown>) {
  if (!AUTH_DEBUG) return;
  console.info("[auth-debug]", message, meta ?? {});
}

function toHandleBase(rawName: string): string {
  const normalized = rawName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length >= 3) {
    return normalized.slice(0, 24);
  }

  return "user";
}

async function allocateUniqueHandle(name: string): Promise<string> {
  const base = toHandleBase(name);
  const MAX_ATTEMPTS = 10;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const handle = attempt === 0 ? base : `${base}-${attempt}`;
    const existing = await prismaClient.user.findFirst({
      where: { handle },
      select: { id: true },
    });
    if (!existing) return handle;
  }

  // Fall back to base + random 6-char suffix to guarantee uniqueness
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureUserHandle(user: {
  id: string;
  name: string;
  handle?: string | null;
}) {
  if (typeof user.handle === "string" && user.handle.length > 0) {
    return user.handle;
  }

  const uniqueHandle = await allocateUniqueHandle(user.name);

  await prismaClient.user.update({
    where: {
      id: user.id,
    },
    data: {
      handle: uniqueHandle,
    },
  });

  return uniqueHandle;
}

const signup = asyncHandler(async (req, res) => {
  const validationResult = CreateUserSchema.safeParse(req.body);
  if (!validationResult.success) {
    throw new ApiError(400, "Enter correct credentials");
  }

  const { name, email, password } = validationResult.data;

  const hashedPassword = await hashPassword(password);
  const uniqueHandle = await allocateUniqueHandle(name);

  //we dont check if user exixsts because we have added @unique in db schema. If the user is not unique, it will throw an error and user creation will be blocked.

  //It also solves the concurrency problem of 2 users making same email at once

  try {
    const user = await prismaClient.user.create({
      data: {
        name,
        handle: uniqueHandle,
        email,
        password: hashedPassword,
        tokenVersion: 0,
        refreshTokenExp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const userTokenVersion = user.tokenVersion ?? 0;
    const accessToken = generateAccessToken(
      user.id,
      user.name,
      userTokenVersion,
    );
    const refreshToken = generateRefreshToken(
      user.id,
      user.name,
      userTokenVersion,
    );

    // Store tokens in httpOnly cookies
    res.cookie("accessToken", accessToken, getCookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          id: user.id,
          name: user.name,
          handle: user.handle ?? uniqueHandle,
          email: user.email,
        },
        "User created successfully",
      ),
    );
  } catch (err: unknown) {
    const e = err as { code?: unknown } | undefined;
    if (e?.code === "P2002") {
      throw new ApiError(409, "User already exists");
    }
    throw err;
  }
});

const signin = asyncHandler(async (req, res) => {
  const validationResult = SignInUserSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new ApiError(400, "Invalid email or password");
  }

  const { email, password } = validationResult.data;

  const user = await prismaClient.user.findUnique({
    where: {
      email: email,
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.password) {
    // Account was created via OAuth — no password is set.
    throw new ApiError(
      401,
      "This account uses social sign-in. Please continue with GitHub or Google.",
    );
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const userTokenVersion = user.tokenVersion ?? 0;
  const ensuredHandle = await ensureUserHandle({
    id: user.id,
    name: user.name,
    handle: user.handle ?? null,
  });
  const accessToken = generateAccessToken(user.id, user.name, userTokenVersion);
  const refreshToken = generateRefreshToken(
    user.id,
    user.name,
    userTokenVersion,
  );

  // Update refresh token expiration
  await prismaClient.user.update({
    where: { id: user.id },
    data: {
      refreshTokenExp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie("accessToken", accessToken, getCookieOptions(15 * 60 * 1000));
  res.cookie("refreshToken", refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        id: user.id,
        name: user.name,
        handle: ensuredHandle,
        email: user.email,
      },
      "Login successful",
    ),
  );
});

/**
 * Returns the currently authenticated user.
 *
 * Primary route is `/auth/current-user` for clarity.
 * `/auth/me` is kept as a shorthand alias for compatibility.
 * It reads `req.userId` from auth middleware and returns that user's profile.
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const user = await prismaClient.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      handle: true,
      email: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const ensuredHandle = await ensureUserHandle({
    id: user.id,
    name: user.name,
    handle: user.handle,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...user,
        handle: ensuredHandle,
      },
      "Current user fetched",
    ),
  );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    authDebug("refresh denied: missing refresh token", {
      hasAccessToken: Boolean(req.cookies?.accessToken),
    });
    throw new ApiError(401, "Refresh token missing");
  }

  let decoded;
  try {
    decoded = verifyToken(refreshToken);
  } catch {
    authDebug("refresh denied: invalid or expired refresh token");
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  if (decoded.type !== "refresh") {
    authDebug("refresh denied: wrong token type", { tokenType: decoded.type });
    throw new ApiError(401, "Invalid token type");
  }

  // Verify user still exists and token version matches (detects compromised tokens)
  const user = await prismaClient.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    authDebug("refresh denied: user not found", { userId: decoded.userId });
    throw new ApiError(401, "User not found");
  }

  const userTokenVersion = user.tokenVersion ?? 0;

  if (userTokenVersion !== decoded.tokenVersion) {
    authDebug("refresh denied: token version mismatch", {
      userId: user.id,
      dbVersion: userTokenVersion,
      tokenVersion: decoded.tokenVersion,
    });
    throw new ApiError(401, "Token has been revoked");
  }

  // Generate new access token (rotation)
  const newAccessToken = generateAccessToken(
    user.id,
    user.name,
    userTokenVersion,
  );

  res.cookie("accessToken", newAccessToken, getCookieOptions(15 * 60 * 1000));

  authDebug("refresh success", { userId: user.id });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Access token refreshed"));
});

const logout = asyncHandler(async (req, res) => {
  const accessToken = req.cookies?.accessToken;

  // Best-effort session invalidation in the database
  if (accessToken) {
    try {
      const decoded = verifyToken(accessToken);
      if (decoded.userId && decoded.type === "access") {
        await prismaClient.user.update({
          where: { id: decoded.userId },
          data: {
            tokenVersion: {
              increment: 1,
            },
            refreshTokenExp: null,
          },
        });
        authDebug("logout: invalidated session in DB", { userId: decoded.userId });
      }
    } catch {
      // Token might be expired or malformed, but we still proceed to clear cookies.
      authDebug("logout: token invalid, skipping DB invalidation");
    }
  }

  // Always clear cookies to ensure frontend state is reset
  const cookieOptions = getCookieOptions(0);
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  authDebug("logout success: cookies cleared");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

/**
 * Requests a password reset link.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(400, "Please provide a valid email");
  }

  const user = await prismaClient.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (user) {
    if (!JWT_SECRET) {
      throw new ApiError(500, "JWT_SECRET is not defined");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        type: "password-reset",
      },
      JWT_SECRET,
      { expiresIn: "30m" },
    );

    const resetLink = `${WEB_APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

    await sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetLink,
    });

    if (AUTH_DEBUG) {
      authDebug("forgot password link generated", {
        email: user.email,
        resetLink,
      });
    }
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        sent: true,
      },
      "If the account exists, reset instructions were sent",
    ),
  );
});

/**
 * Completes password reset by validating a short-lived reset token.
 */
const resetPassword = asyncHandler(async (req, res) => {
  const token =
    typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!token) {
    throw new ApiError(400, "Reset token is required");
  }

  if (!password || password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  if (!JWT_SECRET) {
    throw new ApiError(500, "JWT_SECRET is not defined");
  }

  let decoded: { userId: string; type: string };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
  } catch {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  if (!decoded?.userId || decoded.type !== "password-reset") {
    throw new ApiError(400, "Invalid reset token");
  }

  const hashedPassword = await hashPassword(password);

  await prismaClient.user.update({
    where: { id: decoded.userId },
    data: {
      password: hashedPassword,
      tokenVersion: {
        increment: 1,
      },
      refreshTokenExp: null,
    },
  });

  const cookieOptions = getCookieOptions(0);
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successful"));
});

const getWsToken = asyncHandler(async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const user = await prismaClient.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      name: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!JWT_SECRET) {
    throw new ApiError(500, "JWT_SECRET is not defined");
  }

  const token = jwt.sign(
    { userId, name: user.name, type: "ws-handshake" },
    JWT_SECRET,
    { expiresIn: "30s" },
  );

  return res.json(new ApiResponse(200, { token }, "WS token issued"));
});

export {
  signup,
  signin,
  getCurrentUser,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  getWsToken,
};
