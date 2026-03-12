import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { createRoom, getMessages, getRoomIdFromSlug } from "../controllers/room.controller";

const roomRouter: Router = Router()

roomRouter.post("/", authenticate, createRoom)
roomRouter.get("/:roomId/messages",authenticate, getMessages);
roomRouter.get("/room/slug/:slug", authenticate, getRoomIdFromSlug)

export {roomRouter}