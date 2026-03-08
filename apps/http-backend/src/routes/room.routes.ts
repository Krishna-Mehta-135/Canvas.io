import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { createRoom, getMessages } from "../controllers/room.controller";

const roomRouter: Router = Router()

roomRouter.post("/", authenticate, createRoom)
roomRouter.get("/:roomId/messages",authenticate, getMessages);

export {roomRouter}