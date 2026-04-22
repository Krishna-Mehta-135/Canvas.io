import dotenv from "dotenv";
import {resolve} from "node:path";
import {existsSync} from "node:fs";

// Single source of truth for backend env loading.
const cwd = process.cwd();
const envCandidates = [
    resolve(cwd, ".env"),
    resolve(cwd, ".env.local"),
    resolve(cwd, "../../.env"),
    resolve(cwd, "../../.env.local"),
    resolve(cwd, "../../packages/db/.env"),
    resolve(cwd, "../../packages/db/.env.local"),
];

for (const envPath of envCandidates) {
    if (existsSync(envPath)) {
        dotenv.config({path: envPath, quiet: true});
    }
}

const jwtSecret = process.env.JWT_SECRET;
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const rabbitmqUrl = process.env.RABBITMQ_URL ?? "amqp://guest:guest@127.0.0.1:5672";
const rabbitmqRoomEventsExchange = process.env.RABBITMQ_ROOM_EVENTS_EXCHANGE ?? "canvas.room.events";
const rabbitmqRoomEventsQueuePrefix = process.env.RABBITMQ_ROOM_EVENTS_QUEUE_PREFIX ?? "canvas.room.events.node";
const rabbitmqRoomEventsPartitions = Number(process.env.RABBITMQ_ROOM_EVENTS_PARTITIONS ?? 16);
const rabbitmqPrefetch = Number(process.env.RABBITMQ_PREFETCH ?? 200);
const rabbitmqDbPersistExchange = process.env.RABBITMQ_DB_PERSIST_EXCHANGE ?? "canvas.room.persist";
const rabbitmqDbPersistQueue = process.env.RABBITMQ_DB_PERSIST_QUEUE ?? "canvas.room.persist.jobs";
const rabbitmqDbPersistRoutingKey = process.env.RABBITMQ_DB_PERSIST_ROUTING_KEY ?? "room.persist";

if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined");
}

export const JWT_SECRET: string = jwtSecret;
export const REDIS_URL: string = redisUrl;
export const RABBITMQ_URL: string = rabbitmqUrl;
export const RABBITMQ_ROOM_EVENTS_EXCHANGE: string = rabbitmqRoomEventsExchange;
export const RABBITMQ_ROOM_EVENTS_QUEUE_PREFIX: string = rabbitmqRoomEventsQueuePrefix;
export const RABBITMQ_ROOM_EVENTS_PARTITIONS: number = rabbitmqRoomEventsPartitions;
export const RABBITMQ_PREFETCH: number = rabbitmqPrefetch;
export const RABBITMQ_DB_PERSIST_EXCHANGE: string = rabbitmqDbPersistExchange;
export const RABBITMQ_DB_PERSIST_QUEUE: string = rabbitmqDbPersistQueue;
export const RABBITMQ_DB_PERSIST_ROUTING_KEY: string = rabbitmqDbPersistRoutingKey;
