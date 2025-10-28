import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { signin, signup } from "../controllers/auth.controller";


const authRouter = Router()

authRouter.post("/signup", signup);
authRouter.post("/signin", signin)