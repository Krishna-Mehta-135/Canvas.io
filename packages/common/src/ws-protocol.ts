/**
 * WebSocket Protocol
 * 
 * Defines all message types exchanged between client and WS server.
 * Version tracking prevents overwrite collisions and enables explicit resync.
 */

import type { Shape } from "@repo/canvas-engine";
import {z} from "zod";

const CanvasShapeSchema = z
  .object({
    id: z.string().min(1).max(200),
    type: z.string().min(1).max(64),
  })
  .passthrough();

/**
 * Cursor position shared between collaborators for presence rendering.
 */
export type PresenceCursor = {
  x: number;
  y: number;
};

/**
 * Presence snapshot for one user in a room.
 */
export type RoomPresence = {
  userId: string;
  userName: string;
  cursor: PresenceCursor | null;
  selectedIds: string[];
  tool: string | null;
};

/**
 * Full room-level presence state sent by the websocket server.
 */
export type RoomPresenceState = {
  roomId: number;
  connectedUsersCount: number;
  presences: RoomPresence[];
};

/**
 * Broadcast payload used when the server refreshes room presence.
 */
export type RoomPresenceMessage = RoomPresenceState & {
  type: "room_presence_state";
};

export type WsMessage =
  | { type: "join_room"; roomId: number }
  | {
      type: "room_joined";
      roomId: number;
      version: number;
      shapes: Shape[];
      userId: string;
      connectedUsersCount: number;
      presences: RoomPresence[];
    }
  | {
      type: "canvas_snapshot";
      roomId: number;
      version: number;
      shapes: Shape[];
    }
  | {
      type: "canvas_snapshot_broadcast";
      roomId: number;
      version: number;
      shapes: Shape[];
      senderId: string;
    }
  | {
      type: "canvas_snapshot_ack";
      roomId: number;
      version: number;
    }
  | {
      type: "update_presence";
      roomId: number;
      cursor: PresenceCursor | null;
      selectedIds: string[];
      tool: string | null;
    }
  | RoomPresenceMessage
  | { type: "sync_error"; reason: string }
  | { type: "pong" };

// Server -> Client announcements
export type ServerMessage =
  | {
      type: "room_joined";
      roomId: number;
      version: number;
      shapes: Shape[];
      userId: string;
      connectedUsersCount: number;
      presences: RoomPresence[];
    }
  | {
      type: "canvas_snapshot_broadcast";
      roomId: number;
      version: number;
      shapes: Shape[];
      senderId: string;
    }
  | {
      type: "canvas_snapshot_ack";
      roomId: number;
      version: number;
    }
  | RoomPresenceMessage
  | { type: "sync_error"; reason: string }
  | { type: "pong" };

// Client -> Server commands
export type ClientMessage = Extract<
  WsMessage,
  { type: "join_room" | "canvas_snapshot" | "update_presence" }
>;

export const PresenceCursorSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const JoinRoomMessageSchema = z.object({
  type: z.literal("join_room"),
  roomId: z.number().int().positive(),
});

export const CanvasSnapshotMessageSchema = z.object({
  type: z.literal("canvas_snapshot"),
  roomId: z.number().int().positive(),
  version: z.number().int().min(0),
  shapes: z.array(CanvasShapeSchema).max(5000),
});

export const UpdatePresenceMessageSchema = z.object({
  type: z.literal("update_presence"),
  roomId: z.number().int().positive(),
  cursor: PresenceCursorSchema.nullable(),
  selectedIds: z.array(z.string().min(1).max(200)).max(1000),
  tool: z.string().min(1).max(64).nullable(),
});

export const ClientWsMessageSchema = z.discriminatedUnion("type", [
  JoinRoomMessageSchema,
  CanvasSnapshotMessageSchema,
  UpdatePresenceMessageSchema,
]);

export type ClientWsMessage = z.infer<typeof ClientWsMessageSchema>;

/**
 * Per-room sync state tracked by server.
 * Version increments on each accepted snapshot.
 */
export interface RoomSyncState {
  roomId: number;
  version: number;
  shapes: Shape[];
}
