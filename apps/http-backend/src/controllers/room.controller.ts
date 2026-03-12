import {prismaClient} from "@repo/db/client";
import {ApiError} from "../utils/ApiError";
import {ApiResponse} from "../utils/ApiResponse";
import {CreateRoomSchema} from "@repo/common/types";
import {asyncHandler} from "../utils/asyncHandler";

const createRoom = asyncHandler(async (req, res) => {
    const validationResult = CreateRoomSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "Incorrect input");
    }

    const {slug} = validationResult.data;
    const userId = req.userId;

    if (!userId) {
        throw new ApiError(401, "Unauthorized: User ID not found");
    }

    try {
        const room = await prismaClient.room.create({
            data: {
                slug,
                adminId: userId,
            },
        });

        return res.status(201).json(new ApiResponse(201, room, "Room created successfully"));
    } catch (err: any) {
        if (err.code === "P2002") {
            throw new ApiError(409, "Room already exists");
        }
        throw err;
    }
});

const getMessages = asyncHandler(async (req, res) => {
    const roomId = Number(req.params.roomId);

    if (isNaN(roomId)) {
        throw new ApiError(400, "Invalid roomId");
    }
    const messages = await prismaClient.chat.findMany({
        where: {
            roomId,
        },
        orderBy: {
            id: "desc",
        },
        take: 50,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    res.status(200).json(new ApiResponse(200, messages.reverse(), "Messages fetched successfully"));
});

const getRoomIdFromSlug = asyncHandler(async (req, res) => {
    const slug = req.params.slug;

    if (typeof slug !== "string") {
        throw new ApiError(400, "Invalid slug");
    }

    const room = await prismaClient.room.findUnique({
        where: {
            slug: slug,
        },
    });

    if (!room) {
        throw new ApiError(404, "Room not found");
    }
    
    res.status(200).json(new ApiResponse(200, room, "RoomId successfully fetched from slug"));
});

export {createRoom, getMessages, getRoomIdFromSlug};
