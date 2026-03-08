import express, { Router } from "express"
import { signin, signup } from "../controllers/auth.controller"

const authRouter: Router = express.Router()

authRouter.post("/signup", signup)
authRouter.post("/signin", signin)

export {authRouter}