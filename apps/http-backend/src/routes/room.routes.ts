import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { createRoom, getShapes, getRoomIdFromSlug } from "../controllers/room.controller";

const roomRouter: Router = Router()

roomRouter.post("/", authenticate, createRoom)
roomRouter.get("/:roomId/shapes",authenticate, getShapes);
roomRouter.get("/room/slug/:slug", authenticate, getRoomIdFromSlug)

export {roomRouter}