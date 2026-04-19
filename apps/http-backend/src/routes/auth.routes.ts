import express, { Router } from "express"
import { getCurrentUser, signin, signup } from "../controllers/auth.controller"
import { authenticate } from "../middlewares/auth.middleware"

import { refreshAccessToken, logout } from "../controllers/auth.controller"

const authRouter: Router = express.Router()

// Create a new account and set auth cookies.
authRouter.post("/signup", signup)
// Sign in and set auth cookies.
authRouter.post("/signin", signin)
// Primary self-profile endpoint.
authRouter.get("/current-user", authenticate, getCurrentUser)
// Refresh access token using refresh token.
authRouter.post("/refresh-token", refreshAccessToken)
// Logout and invalidate all tokens.
authRouter.post("/logout", authenticate, logout)

export {authRouter}