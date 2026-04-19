import express, { Router } from "express"
import { getCurrentUser, signin, signup } from "../controllers/auth.controller"
import { authenticate } from "../middlewares/auth.middleware"

const authRouter: Router = express.Router()

// Create a new account and set auth cookie.
authRouter.post("/signup", signup)
// Sign in and set auth cookie.
authRouter.post("/signin", signin)
// Primary self-profile endpoint.
authRouter.get("/current-user", authenticate, getCurrentUser)

export {authRouter}