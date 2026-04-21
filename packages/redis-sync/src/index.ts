import {randomUUID} from "node:crypto";
import Redis from "ioredis";
import type {Shape} from "@repo/canvas-engine";
import type {RoomSyncState} from "@repo/common";
import {REDIS_URL} from "@repo/backend-common/config";

export const NODE_ID = randomUUID();

// Redis is the shared authority for room sync state across all WS processes.
// We keep the protocol contract unchanged and only use Redis internally for
// versioning, snapshot storage, and cross-node fan-out.
const ROOM_CHANNEL_PREFIX = "canvas:room";
const ROOM_VERSION_PREFIX = "canvas:room:version";
const ROOM_SNAPSHOT_PREFIX = "canvas:room:snapshot";

const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
};

const publisher = new Redis(REDIS_URL, redisOptions);
const subscriber = new Redis(REDIS_URL, redisOptions);

export type RedisRoomEvent = {
    roomId: number;
    originNodeId: string;
    version: number;
    shapes: Shape[];
    senderId?: string;
    type: "canvas_snapshot_broadcast";
};

function roomVersionKey(roomId: number) {
    return `${ROOM_VERSION_PREFIX}:${roomId}`;
}

function roomSnapshotKey(roomId: number) {
    return `${ROOM_SNAPSHOT_PREFIX}:${roomId}`;
}

function roomChannel(roomId: number) {
    return `${ROOM_CHANNEL_PREFIX}:${roomId}`;
}

async function ensureReady() {
    if (publisher.status === "wait" || publisher.status === "end") {
        await publisher.connect();
    }

    if (subscriber.status === "wait" || subscriber.status === "end") {
        await subscriber.connect();
    }
}

export async function getRoomVersion(roomId: number) {
    await ensureReady();

    const rawVersion = await publisher.get(roomVersionKey(roomId));
    return Number(rawVersion ?? 0);
}

export async function bumpRoomVersion(roomId: number) {
    await ensureReady();
    return publisher.incr(roomVersionKey(roomId));
}

export async function getRoomSnapshot(roomId: number): Promise<RoomSyncState | null> {
    await ensureReady();

    const [rawVersion, rawSnapshot] = await Promise.all([
        publisher.get(roomVersionKey(roomId)),
        publisher.get(roomSnapshotKey(roomId)),
    ]);

    if (!rawSnapshot) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawSnapshot) as {roomId: number; version: number; shapes: Shape[]};
        return {
            roomId,
            version: Number(rawVersion ?? parsed.version ?? 0),
            shapes: Array.isArray(parsed.shapes) ? parsed.shapes : [],
        };
    } catch {
        return null;
    }
}

export async function setRoomSnapshot(roomId: number, snapshot: Shape[], version: number) {
    await ensureReady();

    const multi = publisher.multi();
    multi.set(roomVersionKey(roomId), String(version));
    multi.set(roomSnapshotKey(roomId), JSON.stringify({roomId, version, shapes: snapshot}));
    await multi.exec();
}

export async function publishRoomEvent(roomId: number, event: Omit<RedisRoomEvent, "roomId">) {
    await ensureReady();

    const payload: RedisRoomEvent = {
        roomId,
        ...event,
    };

    await publisher.publish(roomChannel(roomId), JSON.stringify(payload));
}

// Snapshot commits are atomic at the Redis level: version increment, snapshot
// replacement, and Pub/Sub fan-out all happen together so every node observes
// the same authoritative room transition.
export async function commitRoomSnapshot(
    roomId: number,
    expectedVersion: number,
    snapshot: Shape[],
    event: Pick<RedisRoomEvent, "originNodeId" | "senderId">
) {
    await ensureReady();

    for (let attempt = 0; attempt < 3; attempt += 1) {
        // WATCH keeps the write safe if another node wins the version race.
        await publisher.watch(roomVersionKey(roomId));
        const currentVersion = Number((await publisher.get(roomVersionKey(roomId))) ?? 0);

        if (currentVersion !== expectedVersion) {
            await publisher.unwatch();
            return null;
        }

        const nextVersion = currentVersion + 1;
        const payload: RedisRoomEvent = {
            roomId,
            originNodeId: event.originNodeId,
            senderId: event.senderId,
            type: "canvas_snapshot_broadcast",
            version: nextVersion,
            shapes: snapshot,
        };

        const transaction = publisher.multi();
        transaction.incr(roomVersionKey(roomId));
        transaction.set(roomSnapshotKey(roomId), JSON.stringify({roomId, version: nextVersion, shapes: snapshot}));
        transaction.publish(roomChannel(roomId), JSON.stringify(payload));

        const result = await transaction.exec();
        if (result) {
            return nextVersion;
        }
    }

    return null;
}

export async function subscribeRoomEvents(handler: (event: RedisRoomEvent) => void | Promise<void>) {
    await ensureReady();

    // Every WS node subscribes to every room topic and filters by roomId in the
    // payload. That keeps the wiring simple and avoids per-room subscription
    // churn when rooms are created or destroyed.
    await subscriber.psubscribe(`${ROOM_CHANNEL_PREFIX}:*`);
    subscriber.on("pmessage", async (_pattern: string, channel: string, message: string) => {
        try {
            if (!channel.startsWith(`${ROOM_CHANNEL_PREFIX}:`)) {
                return;
            }

            const event = JSON.parse(message) as RedisRoomEvent;
            if (typeof event.roomId !== "number" || !event.originNodeId) {
                return;
            }

            await handler(event);
        } catch (error) {
            console.error("[WS][Redis] Failed to process room event", {channel, error});
        }
    });
}
