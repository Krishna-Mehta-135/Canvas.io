import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
	createRoom,
	listMyRooms,
	getShapes,
	getRoomIdFromSlug,
	getRoomByOwnerAndSlug,
	replaceShapes,
	renameRoomSlug,
	getInviteLink,
	requestRoomAccess,
	listIncomingRoomAccessRequests,
	decideRoomAccessRequest,
} from "../controllers/room.controller";

const roomRouter: Router = Router()

roomRouter.post("/", authenticate, createRoom)
roomRouter.get("/mine", authenticate, listMyRooms)
roomRouter.get("/:roomId/shapes",authenticate, getShapes);
roomRouter.put("/:roomId/shapes", authenticate, replaceShapes);
roomRouter.get("/room/slug/:slug", authenticate, getRoomIdFromSlug)
roomRouter.get("/resolve/:userHandle/:slug", authenticate, getRoomByOwnerAndSlug)
roomRouter.patch("/:roomId/slug", authenticate, renameRoomSlug)
roomRouter.get("/:roomId/invite", authenticate, getInviteLink)
roomRouter.post("/access/request", authenticate, requestRoomAccess)
roomRouter.get("/access/requests/incoming", authenticate, listIncomingRoomAccessRequests)
roomRouter.post("/access/requests/decision", authenticate, decideRoomAccessRequest)

export {roomRouter}