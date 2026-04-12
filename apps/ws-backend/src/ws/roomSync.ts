import {prismaClient} from "@repo/db/client";
import type {Shape} from "@repo/canvas-engine";
import type {RoomSyncState} from "@repo/common";

/**
 * roomSyncState
 *
 * Per-room sync state: version number and current shapes.
 * Version increments on each accepted snapshot from clients.
 */
export const roomSyncState = new Map<number, RoomSyncState>();

export async function initializeRoomSync(roomId: number) {
    if (roomSyncState.has(roomId)) {
        return roomSyncState.get(roomId)!;
    }

    const shapes = await prismaClient.shape.findMany({
        where: {
            roomId,
            deleted: false,
        },
        orderBy: {
            createdAt: "asc",
        },
    });

    const state: RoomSyncState = {
        roomId,
        version: 0,
        shapes: shapes.map((shape) => shape.props as Shape),
    };

    roomSyncState.set(roomId, state);
    return state;
}

export async function persistShapes(roomId: number, shapes: Shape[]) {
    // Validate all shapes have required fields
    for (const shape of shapes) {
        if (!shape.id || typeof shape.id !== "string") {
            throw new Error("All shapes must have a valid string id");
        }
        if (!shape.type || typeof shape.type !== "string") {
            throw new Error("All shapes must have a valid string type");
        }
    }

    // Deduplicate shapes by ID (keep last occurrence)
    const uniqueShapesMap = new Map<string, Shape>();
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
}
