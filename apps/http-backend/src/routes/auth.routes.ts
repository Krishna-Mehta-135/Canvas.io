import express, { Router } from "express"
import { getCurrentUser, signin, signup } from "../controllers/auth.controller"
import { authenticate } from "../middlewares/auth.middleware"
import { idempotencyMiddleware } from "../middlewares/idempotency.middleware"

import { refreshAccessToken, logout } from "../controllers/auth.controller"
import { forgotPassword, resetPassword } from "../controllers/auth.controller"

const authRouter: Router = express.Router()

// Create a new account and set auth cookies.
authRouter.post("/signup", idempotencyMiddleware, signup)
// Sign in and set auth cookies.
authRouter.post("/signin", idempotencyMiddleware, signin)
// Primary self-profile endpoint.
authRouter.get("/current-user", authenticate, getCurrentUser)
// Refresh access token using refresh token.
authRouter.post("/refresh-token", refreshAccessToken)
// Logout and invalidate all tokens.
authRouter.post("/logout", authenticate, logout)
// Request password reset instructions.
authRouter.post("/forgot-password", idempotencyMiddleware, forgotPassword)
// Complete password reset with token.
authRouter.post("/reset-password", idempotencyMiddleware, resetPassword)

export {authRouter}