import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { createRoom, getShapes, getRoomIdFromSlug, replaceShapes, getInviteLink } from "../controllers/room.controller";

const roomRouter: Router = Router()

roomRouter.post("/", authenticate, createRoom)
roomRouter.get("/:roomId/shapes",authenticate, getShapes);
roomRouter.put("/:roomId/shapes", authenticate, replaceShapes);
roomRouter.get("/room/slug/:slug", authenticate, getRoomIdFromSlug)
roomRouter.get("/:roomId/invite", authenticate, getInviteLink)

export {roomRouter}