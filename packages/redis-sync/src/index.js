"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NODE_ID = void 0;
exports.getRoomVersion = getRoomVersion;
exports.bumpRoomVersion = bumpRoomVersion;
exports.getRoomSnapshot = getRoomSnapshot;
exports.setRoomSnapshot = setRoomSnapshot;
exports.publishRoomEvent = publishRoomEvent;
exports.commitRoomSnapshot = commitRoomSnapshot;
exports.subscribeRoomEvents = subscribeRoomEvents;
exports.checkRedisRateLimit = checkRedisRateLimit;
const node_crypto_1 = require("node:crypto");
const ioredis_1 = __importDefault(require("ioredis"));
const ws_protocol_1 = require("@repo/common/ws-protocol");
const config_1 = require("@repo/backend-common/config");
exports.NODE_ID = (0, node_crypto_1.randomUUID)();
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
const publisher = new ioredis_1.default(config_1.REDIS_URL, redisOptions);
const subscriber = new ioredis_1.default(config_1.REDIS_URL, redisOptions);
const RATE_LIMIT_KEY_PREFIX = "canvas:http:rate-limit";
function roomVersionKey(roomId) {
    return `${ROOM_VERSION_PREFIX}:${roomId}`;
}
function roomSnapshotKey(roomId) {
    return `${ROOM_SNAPSHOT_PREFIX}:${roomId}`;
}
function roomChannel(roomId) {
    return `${ROOM_CHANNEL_PREFIX}:${roomId}`;
}
function rateLimitKey(routeKey) {
    return `${RATE_LIMIT_KEY_PREFIX}:${routeKey}`;
}
async function ensureReady() {
    if (publisher.status === "wait" || publisher.status === "end") {
        await publisher.connect();
    }
    if (subscriber.status === "wait" || subscriber.status === "end") {
        await subscriber.connect();
    }
}
async function getRoomVersion(roomId) {
    await ensureReady();
    const rawVersion = await publisher.get(roomVersionKey(roomId));
    return Number(rawVersion ?? 0);
}
async function bumpRoomVersion(roomId) {
    await ensureReady();
    return publisher.incr(roomVersionKey(roomId));
}
async function getRoomSnapshot(roomId) {
    await ensureReady();
    const [rawVersion, rawSnapshot] = await Promise.all([
        publisher.get(roomVersionKey(roomId)),
        publisher.get(roomSnapshotKey(roomId)),
    ]);
    if (!rawSnapshot) {
        return null;
    }
    try {
        const parsed = JSON.parse(rawSnapshot);
        return {
            roomId,
            version: Number(rawVersion ?? parsed.version ?? 0),
            shapes: Array.isArray(parsed.shapes) ? parsed.shapes : [],
        };
    }
    catch {
        return null;
    }
}
async function setRoomSnapshot(roomId, snapshot, version) {
    await ensureReady();
    const multi = publisher.multi();
    multi.set(roomVersionKey(roomId), String(version));
    multi.set(roomSnapshotKey(roomId), JSON.stringify({ roomId, version, shapes: snapshot }));
    await multi.exec();
}
async function publishRoomEvent(roomId, event) {
    await ensureReady();
    const payload = {
        roomId,
        ...event,
    };
    await publisher.publish(roomChannel(roomId), JSON.stringify(payload));
}
// Snapshot commits are atomic at the Redis level: version increment, snapshot
// replacement, and Pub/Sub fan-out all happen together so every node observes
// the same authoritative room transition.
async function commitRoomSnapshot(roomId, expectedVersion, snapshot, event) {
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
        const payload = {
            roomId,
            originNodeId: event.originNodeId,
            senderId: event.senderId,
            actionId: event.actionId,
            publishedAtMs: Date.now(),
            type: "canvas_snapshot_broadcast",
            version: nextVersion,
            shapes: snapshot,
        };
        const transaction = publisher.multi();
        transaction.incr(roomVersionKey(roomId));
        transaction.set(roomSnapshotKey(roomId), JSON.stringify({ roomId, version: nextVersion, shapes: snapshot }));
        transaction.publish(roomChannel(roomId), JSON.stringify(payload));
        const result = await transaction.exec();
        if (result) {
            return nextVersion;
        }
    }
    return null;
}
async function subscribeRoomEvents(handler) {
    await ensureReady();
    // Every WS node subscribes to every room topic and filters by roomId in the
    // payload. That keeps the wiring simple and avoids per-room subscription
    // churn when rooms are created or destroyed.
    await subscriber.psubscribe(`${ROOM_CHANNEL_PREFIX}:*`);
    subscriber.on("pmessage", async (_pattern, channel, message) => {
        try {
            if (!channel.startsWith(`${ROOM_CHANNEL_PREFIX}:`)) {
                return;
            }
            const event = JSON.parse(message);
            const parsedEvent = ws_protocol_1.RoomSnapshotBroadcastEventSchema.safeParse(event);
            if (!parsedEvent.success) {
                return;
            }
            const normalizedEvent = {
                ...parsedEvent.data,
                shapes: parsedEvent.data.shapes,
            };
            await handler(normalizedEvent);
        }
        catch (error) {
            console.error("[WS][Redis] Failed to process room event", { channel, error });
        }
    });
}
async function checkRedisRateLimit(routeKey, limit, windowMs) {
    await ensureReady();
    const safeLimit = Math.max(1, Math.floor(limit));
    const safeWindowMs = Math.max(1, Math.floor(windowMs));
    const key = rateLimitKey(routeKey);
    const now = Date.now();
    const script = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  ttl = tonumber(ARGV[1])
end
return {current, ttl}
`;
    const result = (await publisher.eval(script, 1, key, String(safeWindowMs)));
    const current = Array.isArray(result) ? Number(result[0] ?? 0) : 0;
    const ttlMs = Array.isArray(result) ? Number(result[1] ?? safeWindowMs) : safeWindowMs;
    const resetAtMs = now + Math.max(0, ttlMs);
    const allowed = current <= safeLimit;
    return {
        allowed,
        current,
        limit: safeLimit,
        remaining: Math.max(0, safeLimit - current),
        resetAtMs,
        retryAfterMs: allowed ? 0 : Math.max(0, ttlMs),
    };
}
