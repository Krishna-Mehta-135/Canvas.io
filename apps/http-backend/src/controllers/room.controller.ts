import {prismaClient} from "@repo/db/client";
import {ApiError} from "../utils/ApiError";
import {ApiResponse} from "../utils/ApiResponse";
import {CreateRoomSchema, RenameRoomSlugSchema} from "@repo/common/types";
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
            include: {
                admin: {
                    select: {
                        handle: true,
                        name: true,
                    },
                },
            },
        });

        const canonicalPath = `/room/${room.admin.handle ?? room.admin.name}/${room.slug}`;

        return res.status(201).json(
            new ApiResponse(
                201,
                {
                    ...room,
                    canonicalPath,
                },
                "Room created successfully"
            )
        );
    } catch (err: any) {
        if (err.code === "P2002") {
            throw new ApiError(409, "Room slug already exists for this user");
        }
        throw err;
    }
});

const listMyRooms = asyncHandler(async (req, res) => {
    const userId = req.userId;

    if (!userId) {
        throw new ApiError(401, "Unauthorized: User ID not found");
    }

    const rooms = await prismaClient.room.findMany({
        where: {
            adminId: userId,
        },
        orderBy: {
            createdAt: "desc",
        },
        include: {
            admin: {
                select: {
                    id: true,
                    handle: true,
                    name: true,
                },
            },
        },
    });

    const payload = rooms.map((room) => ({
        ...room,
        canonicalPath: `/room/${room.admin.handle ?? room.admin.name}/${room.slug}`,
    }));

    res.status(200).json(new ApiResponse(200, payload, "Rooms fetched successfully"));
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
        // Deduplicate shapes by ID (keep last occurrence) to avoid unique constraint violations
        const uniqueShapesMap = new Map();
        for (const shape of shapes) {
            uniqueShapesMap.set(shape.id, shape);
        }
        const uniqueShapes = Array.from(uniqueShapesMap.values());
        
        await prismaClient.$transaction(async (tx) => {
            await tx.shape.deleteMany({
                where: {
                    roomId,
                },
            });

            if (uniqueShapes.length > 0) {
                await tx.shape.createMany({
                    data: uniqueShapes.map((shape) => ({
                        // Database id must be globally unique across all rooms.
                        // Keep client shape.id inside props unchanged for canvas logic.
                        id: `${roomId}:${shape.id}`,
                        roomId,
                        type: shape.type,
                        props: shape,
                        deleted: false,
                    })),
                    skipDuplicates: true,
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
            console.error(`Prisma error ${err.code} while persisting shapes for roomId ${roomId}:`, err);
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

    const room = await prismaClient.room.findFirst({
        where: {
            adminId: req.userId,
            slug,
        },
        include: {
            admin: {
                select: {
                    id: true,
                    handle: true,
                    name: true,
                },
            },
        },
    });

    if (!room) {
        throw new ApiError(404, "Room not found");
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                ...room,
                canonicalPath: `/room/${room.admin.handle ?? room.admin.name}/${room.slug}`,
            },
            "RoomId successfully fetched from slug"
        )
    );
});

const getRoomByOwnerAndSlug = asyncHandler(async (req, res) => {
    const ownerHandle = req.params.userHandle;
    const slug = req.params.slug;

    if (typeof ownerHandle !== "string" || typeof slug !== "string") {
        throw new ApiError(400, "Invalid room route parameters");
    }

    const owner = await prismaClient.user.findUnique({
        where: {
            handle: ownerHandle,
        },
        select: {
            id: true,
            name: true,
            handle: true,
        },
    });

    if (!owner) {
        throw new ApiError(404, "Room owner not found");
    }

    const room = await prismaClient.room.findFirst({
        where: {
            adminId: owner.id,
            slug,
        },
        include: {
            admin: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                },
            },
        },
    });

    if (!room) {
        throw new ApiError(404, "Room not found");
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                ...room,
                canonicalPath: `/room/${owner.handle}/${room.slug}`,
            },
            "Room fetched successfully"
        )
    );
});

const renameRoomSlug = asyncHandler(async (req, res) => {
    const roomId = Number(req.params.roomId);

    if (isNaN(roomId)) {
        throw new ApiError(400, "Invalid roomId");
    }

    const validationResult = RenameRoomSlugSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "Incorrect input");
    }

    const userId = req.userId;
    if (!userId) {
        throw new ApiError(401, "Unauthorized: User ID not found");
    }

    const room = await prismaClient.room.findUnique({
        where: {id: roomId},
        select: {
            id: true,
            adminId: true,
        },
    });

    if (!room) {
        throw new ApiError(404, "Room not found");
    }

    if (room.adminId !== userId) {
        throw new ApiError(403, "Only room owner can rename room slug");
    }

    try {
        const updatedRoom = await prismaClient.room.update({
            where: {id: roomId},
            data: {
                slug: validationResult.data.slug,
            },
            include: {
                admin: {
                    select: {
                        id: true,
                        handle: true,
                        name: true,
                    },
                },
            },
        });

        res.status(200).json(
            new ApiResponse(
                200,
                {
                    ...updatedRoom,
                    canonicalPath: `/room/${updatedRoom.admin.handle ?? updatedRoom.admin.name}/${updatedRoom.slug}`,
                },
                "Room slug updated successfully"
            )
        );
    } catch (err: any) {
        if (err?.code === "P2002") {
            throw new ApiError(409, "Room slug already exists for this user");
        }
        throw err;
    }
});

const getInviteLink = asyncHandler(async (req, res) => {
    const roomId = Number(req.params.roomId);

    if (isNaN(roomId)) {
        throw new ApiError(400, "Invalid roomId");
    }

    const room = await prismaClient.room.findUnique({
        where: {
            id: roomId,
        },
        include: {
            admin: {
                select: {
                    handle: true,
                    name: true,
                },
            },
        },
    });

    if (!room) {
        throw new ApiError(404, "Room not found");
    }

    // Generate invite link using canonical owner handle + slug URL shape.
    const ownerSegment = room.admin.handle ?? room.admin.name;
    const inviteLink = `${req.protocol}://${req.get("host")}/room/${ownerSegment}/${room.slug}`;

    res.status(200).json(
        new ApiResponse(
            200,
            { inviteLink, roomSlug: room.slug },
            "Invite link generated successfully"
        )
    );
});

export {
    createRoom,
    listMyRooms,
    getShapes,
    replaceShapes,
    getRoomIdFromSlug,
    getRoomByOwnerAndSlug,
    renameRoomSlug,
    getInviteLink,
};
