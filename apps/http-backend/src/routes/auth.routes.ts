import express, { Router } from "express"
import { createRoom, signin, signup } from "../controllers/auth.controller"
import { authenticate } from "../middlewares/auth.middleware"

const authRouter: Router = express.Router()

authRouter.post("/signup", signup)
authRouter.post("/signin", signin)
authRouter.post("/create-room", authenticate, createRoom)

export {authRouter}