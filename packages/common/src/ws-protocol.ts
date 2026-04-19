/**
 * WebSocket Protocol
 * 
 * Defines all message types exchanged between client and WS server.
 * Version tracking prevents overwrite collisions and enables explicit resync.
 */

import { Shape } from "@repo/canvas-engine";

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

/**
 * Per-room sync state tracked by server.
 * Version increments on each accepted snapshot.
 */
export interface RoomSyncState {
  roomId: number;
  version: number;
  shapes: Shape[];
}
