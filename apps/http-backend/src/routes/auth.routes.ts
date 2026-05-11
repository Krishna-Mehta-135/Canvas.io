import express, { Router } from "express";
import {
  forgotPassword,
  getCurrentUser,
  getWsToken,
  logout,
  refreshAccessToken,
  resetPassword,
  signin,
  signup,
} from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { idempotencyMiddleware } from "../middlewares/idempotency.middleware";

import {
  githubCallback,
  githubInitiate,
  googleCallback,
  googleInitiate,
} from "../controllers/oauth.controller";

const authRouter: Router = express.Router();

// Create a new account and set auth cookies.
authRouter.post("/signup", idempotencyMiddleware, signup);
// Sign in and set auth cookies.
authRouter.post("/signin", idempotencyMiddleware, signin);
// Primary self-profile endpoint.
authRouter.get("/current-user", authenticate, getCurrentUser);
// Generate a short-lived token for WebSocket handshakes.
authRouter.get("/ws-token", authenticate, getWsToken);
// Refresh access token using refresh token.
authRouter.post("/refresh-token", refreshAccessToken);
// Logout and invalidate all tokens.
authRouter.post("/logout", authenticate, logout);
// Request password reset instructions.
authRouter.post("/forgot-password", idempotencyMiddleware, forgotPassword);
// Complete password reset with token.
authRouter.post("/reset-password", idempotencyMiddleware, resetPassword);

// ── OAuth ──────────────────────────────────────────────────────────────────────
// Redirect user to GitHub/Google login page.
authRouter.get("/github", githubInitiate);
authRouter.get("/google", googleInitiate);
// Provider redirects back here with an authorization code.
authRouter.get("/github/callback", githubCallback);
authRouter.get("/google/callback", googleCallback);

export { authRouter };
