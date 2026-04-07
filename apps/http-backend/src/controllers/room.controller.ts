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

const getShapes = asyncHandler(async (req, res) => {
    const roomId = Number(req.params.roomId);

    if (isNaN(roomId)) {
        throw new ApiError(400, "Invalid roomId");
    }

    try {
        const shapes = await prismaClient.shape.findMany({
            where: {
                roomId,
                deleted: false,
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        const serializedShapes = shapes.map((shape) => shape.props);

        res.status(200).json(new ApiResponse(200, serializedShapes, "Shapes fetched successfully"));
    } catch (err: any) {
        // If Prisma schema is out-of-sync (missing table/columns), keep canvas usable.
        if (err?.code === "P2021" || err?.code === "P2022") {
            return res.status(200).json(new ApiResponse(200, [], "Shapes unavailable; returned empty state"));
        }

        // For any known Prisma request failure, avoid opaque 500 for initial canvas load.
        if (typeof err?.code === "string" && err.code.startsWith("P")) {
            return res.status(200).json(new ApiResponse(200, [], "Shapes unavailable; returned empty state"));
        }

        throw err;
    }
});

//save the full current canvas snapshot for this room
const replaceShapes = asyncHandler(async (req, res) => {
    const roomId = Number(req.params.roomId);

    if (isNaN(roomId)) {
        throw new ApiError(400, "Invalid roomId");
    }

    const shapes = req.body?.shapes;

    if (!Array.isArray(shapes)) {
        throw new ApiError(400, "shapes must be an array");
    }

    for (const shape of shapes) {
        if (typeof shape !== "object" || shape === null) {
            throw new ApiError(400, "Each shape must be an object");
        }

        if (typeof shape.id !== "string" || typeof shape.type !== "string") {
            throw new ApiError(400, "Each shape must include string id and type");
        }
    }

    try {
        await prismaClient.$transaction(async (tx) => {
            await tx.shape.deleteMany({
                where: {
                    roomId,
                },
            });

            if (shapes.length > 0) {
                await tx.shape.createMany({
                    data: shapes.map((shape) => ({
                        id: shape.id,
                        roomId,
                        type: shape.type,
                        props: shape,
                        deleted: false,
                    })),
                });
            }
        });
    } catch (err: any) {
        if (err?.code === "P2021" || err?.code === "P2022") {
            throw new ApiError(503, "Shape storage is not ready. Run database migrations/push first.");
        }

        if (err?.code === "P2003") {
            throw new ApiError(404, "Room not found for provided roomId");
        }

        if (typeof err?.code === "string" && err.code.startsWith("P")) {
            throw new ApiError(503, "Shape storage is temporarily unavailable");
        }

        throw err;
    }

    res.status(200).json(new ApiResponse(200, null, "Shapes saved successfully"));
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

export {createRoom, getShapes, replaceShapes, getRoomIdFromSlug};
