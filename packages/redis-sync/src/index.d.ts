import type { Shape } from "@repo/canvas-engine";
import type { RoomSyncState } from "@repo/common";
export declare const NODE_ID: `${string}-${string}-${string}-${string}-${string}`;
export type RedisRateLimitResult = {
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
    resetAtMs: number;
    retryAfterMs: number;
};
export type RedisRoomEvent = {
    roomId: number;
    originNodeId: string;
    version: number;
    shapes: Shape[];
    senderId?: string;
    actionId: string;
    publishedAtMs: number;
    type: "canvas_snapshot_broadcast";
};
export declare function getRoomVersion(roomId: number): Promise<number>;
export declare function bumpRoomVersion(roomId: number): Promise<number>;
export declare function getRoomSnapshot(roomId: number): Promise<RoomSyncState | null>;
export declare function setRoomSnapshot(roomId: number, snapshot: Shape[], version: number): Promise<void>;
export declare function publishRoomEvent(roomId: number, event: Omit<RedisRoomEvent, "roomId">): Promise<void>;
export declare function commitRoomSnapshot(roomId: number, expectedVersion: number, snapshot: Shape[], event: Pick<RedisRoomEvent, "originNodeId" | "senderId" | "actionId">): Promise<number | null>;
export declare function subscribeRoomEvents(handler: (event: RedisRoomEvent) => void | Promise<void>): Promise<void>;
export declare function checkRedisRateLimit(routeKey: string, limit: number, windowMs: number): Promise<RedisRateLimitResult>;
//# sourceMappingURL=index.d.ts.map