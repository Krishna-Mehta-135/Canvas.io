import {prismaClient} from "@repo/db/client";
import {ApiError} from "../utils/ApiError";
import {ApiResponse} from "../utils/ApiResponse";
import {
    CreateRoomSchema,
    RenameRoomSlugSchema,
    RoomIdParamSchema,
    RoomSlugParamSchema,
    OwnerSlugParamsSchema,
    ReplaceShapesBodySchema,
    RoomAccessRequestCreateSchema,
    RoomAccessRequestDecisionSchema,
} from "@repo/common/types";
import {asyncHandler} from "../utils/asyncHandler";

function requireUserId(userId?: string) {
    if (!userId) {
        throw new ApiError(401, "Unauthorized: User ID not found");
    }

    return userId;
}

function buildCanonicalRoomPath(room: {slug: string; admin: {handle: string | null}}) {
    const handle = room.admin.handle?.trim();

    // Use the owner handle when we have one. Fall back to the slug-only canvas
    // route so invite/open flows still work for accounts that have not set a handle.
    return handle ? `/room/${handle}/${room.slug}` : `/canvas/${room.slug}`;
}

async function assertOwnerRoomAccess(roomId: number, userId: string) {
    const room = await prismaClient.room.findFirst({
        where: {
            id: roomId,
            adminId: userId,
        },
        select: {
            id: true,
            adminId: true,
        },
    });

    if (!room) {
        // Return forbidden uniformly to avoid leaking room existence.
        throw new ApiError(403, "Forbidden");
    }

    return room;
}

async function hasRoomAccess(roomId: number, userId: string) {
    const room = await prismaClient.room.findFirst({
        where: {
            id: roomId,
            OR: [
                {adminId: userId},
                {
                    members: {
                        some: {
                            userId,
                        },
                    },
                },
            ],
        },
        select: {
            id: true,
        },
    });

    return Boolean(room);
}

const createRoom = asyncHandler(async (req, res) => {
    const validationResult = CreateRoomSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "Incorrect input");
    }

    const {slug} = validationResult.data;
    const userId = requireUserId(req.userId);

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

        const canonicalPath = buildCanonicalRoomPath(room);

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
    const userId = requireUserId(req.userId);

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
        canonicalPath: buildCanonicalRoomPath(room),
    }));

    res.status(200).json(new ApiResponse(200, payload, "Rooms fetched successfully"));
});

const getShapes = asyncHandler(async (req, res) => {
    const paramsValidation = RoomIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        throw new ApiError(400, "Invalid roomId");
    }

    const {roomId} = paramsValidation.data;

    const userId = requireUserId(req.userId);
    const canAccess = await hasRoomAccess(roomId, userId);
    if (!canAccess) {
        throw new ApiError(403, "Forbidden");
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
    const paramsValidation = RoomIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        throw new ApiError(400, "Invalid roomId");
    }

    const {roomId} = paramsValidation.data;

    const userId = requireUserId(req.userId);
    await assertOwnerRoomAccess(roomId, userId);

    const bodyValidation = ReplaceShapesBodySchema.safeParse(req.body);
    if (!bodyValidation.success) {
        throw new ApiError(400, "Invalid shapes payload");
    }

    const {shapes} = bodyValidation.data;

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
    const paramsValidation = RoomSlugParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        throw new ApiError(400, "Invalid slug");
    }

    const userId = requireUserId(req.userId);
    const {slug} = paramsValidation.data;

    const room = await prismaClient.room.findFirst({
        where: {
            adminId: userId,
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
                canonicalPath: buildCanonicalRoomPath(room),
            },
            "RoomId successfully fetched from slug"
        )
    );
});

const getRoomByOwnerAndSlug = asyncHandler(async (req, res) => {
    const paramsValidation = OwnerSlugParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        throw new ApiError(400, "Invalid room route parameters");
    }

    const userId = requireUserId(req.userId);
    const {userHandle: ownerHandle, slug} = paramsValidation.data;

    const room = await prismaClient.room.findFirst({
        where: {
            slug,
            admin: {
                handle: ownerHandle,
            },
            OR: [
                {adminId: userId},
                {
                    members: {
                        some: {
                            userId,
                        },
                    },
                },
            ],
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
        throw new ApiError(403, "Forbidden");
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                ...room,
                canonicalPath: buildCanonicalRoomPath(room),
            },
            "Room fetched successfully"
        )
    );
});

const renameRoomSlug = asyncHandler(async (req, res) => {
    const paramsValidation = RoomIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        throw new ApiError(400, "Invalid roomId");
    }

    const {roomId} = paramsValidation.data;

    const validationResult = RenameRoomSlugSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "Incorrect input");
    }

    const userId = requireUserId(req.userId);
    await assertOwnerRoomAccess(roomId, userId);

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
                    canonicalPath: buildCanonicalRoomPath(updatedRoom),
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
    const paramsValidation = RoomIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        throw new ApiError(400, "Invalid roomId");
    }

    const userId = requireUserId(req.userId);
    const {roomId} = paramsValidation.data;

    await assertOwnerRoomAccess(roomId, userId);

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
        throw new ApiError(403, "Forbidden");
    }

    const inviteLink = `${req.protocol}://${req.get("host")}${buildCanonicalRoomPath(room)}`;

    res.status(200).json(
        new ApiResponse(
            200,
            { inviteLink, canonicalPath: buildCanonicalRoomPath(room), roomSlug: room.slug },
            "Invite link generated successfully"
        )
    );
});

const requestRoomAccess = asyncHandler(async (req, res) => {
    const validationResult = RoomAccessRequestCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "Invalid access request payload");
    }

    const requesterId = requireUserId(req.userId);
    const {ownerHandle, slug, note} = validationResult.data;

    const room = await prismaClient.room.findFirst({
        where: {
            slug,
            admin: {
                handle: ownerHandle,
            },
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

    if (room.adminId === requesterId) {
        throw new ApiError(400, "You already own this room");
    }

    const existingMembership = await prismaClient.roomMember.findUnique({
        where: {
            roomId_userId: {
                roomId: room.id,
                userId: requesterId,
            },
        },
    });

    if (existingMembership) {
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    roomId: room.id,
                    status: "approved",
                },
                "You already have access to this room"
            )
        );
    }

    const existingRequest = await prismaClient.roomAccessRequest.findUnique({
        where: {
            roomId_requesterId: {
                roomId: room.id,
                requesterId,
            },
        },
    });

    if (existingRequest && existingRequest.status === "pending") {
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    requestId: existingRequest.id,
                    roomId: room.id,
                    status: existingRequest.status,
                },
                "Access request already pending"
            )
        );
    }

    const nextRequest = existingRequest
        ? await prismaClient.roomAccessRequest.update({
              where: {
                  id: existingRequest.id,
              },
              data: {
                  status: "pending",
                  decisionNote: note,
                  respondedAt: null,
              },
          })
        : await prismaClient.roomAccessRequest.create({
              data: {
                  roomId: room.id,
                  requesterId,
                  status: "pending",
                  decisionNote: note,
              },
          });

    res.status(201).json(
        new ApiResponse(
            201,
            {
                requestId: nextRequest.id,
                roomId: room.id,
                status: nextRequest.status,
            },
            "Access request sent to room owner"
        )
    );
});

const listIncomingRoomAccessRequests = asyncHandler(async (req, res) => {
    const ownerId = requireUserId(req.userId);

    const requests = await prismaClient.roomAccessRequest.findMany({
        where: {
            status: "pending",
            room: {
                adminId: ownerId,
            },
        },
        include: {
            room: {
                select: {
                    id: true,
                    slug: true,
                    admin: {
                        select: {
                            handle: true,
                            name: true,
                        },
                    },
                },
            },
            requester: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    email: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    res.status(200).json(new ApiResponse(200, requests, "Incoming access requests fetched"));
});

const decideRoomAccessRequest = asyncHandler(async (req, res) => {
    const validationResult = RoomAccessRequestDecisionSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "Invalid access decision payload");
    }

    const ownerId = requireUserId(req.userId);
    const {requestId, action, note} = validationResult.data;

    const accessRequest = await prismaClient.roomAccessRequest.findUnique({
        where: {
            id: requestId,
        },
        include: {
            room: {
                select: {
                    id: true,
                    adminId: true,
                },
            },
        },
    });

    if (!accessRequest) {
        throw new ApiError(404, "Access request not found");
    }

    if (accessRequest.room.adminId !== ownerId) {
        throw new ApiError(403, "Forbidden");
    }

    if (accessRequest.status !== "pending") {
        throw new ApiError(409, "Access request is already resolved");
    }

    await prismaClient.$transaction(async (tx) => {
        await tx.roomAccessRequest.update({
            where: {
                id: accessRequest.id,
            },
            data: {
                status: action === "approve" ? "approved" : "rejected",
                respondedAt: new Date(),
                decisionNote: note,
            },
        });

        if (action === "approve") {
            await tx.roomMember.upsert({
                where: {
                    roomId_userId: {
                        roomId: accessRequest.room.id,
                        userId: accessRequest.requesterId,
                    },
                },
                create: {
                    roomId: accessRequest.room.id,
                    userId: accessRequest.requesterId,
                },
                update: {},
            });
        }
    });

    res.status(200).json(
        new ApiResponse(
            200,
            {
                requestId: accessRequest.id,
                action,
            },
            `Access request ${action}d`
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
    requestRoomAccess,
    listIncomingRoomAccessRequests,
    decideRoomAccessRequest,
};
