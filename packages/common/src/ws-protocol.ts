/**
 * WebSocket Protocol
 * 
 * Defines all message types exchanged between client and WS server.
 * Version tracking prevents overwrite collisions and enables explicit resync.
 */

import { Shape } from "@repo/canvas-engine";

export type WsMessage =
  | { type: "join_room"; roomId: number }
  | { type: "room_joined"; roomId: number; version: number; shapes: Shape[] }
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
  | { type: "sync_error"; reason: string }
  | { type: "pong" };

// Server -> Client announcements
export type ServerMessage = Extract<
  WsMessage,
  {
    type:
      | "room_joined"
      | "canvas_snapshot_broadcast"
      | "sync_error"
      | "pong";
  }
>;

// Client -> Server commands
export type ClientMessage = Extract<
  WsMessage,
  { type: "join_room" | "canvas_snapshot" }
>;

/**
 * Per-room sync state tracked by server.
 * version increments on each accepted snapshot.
 */
export interface RoomSyncState {
  roomId: number;
  version: number;
  shapes: Shape[];
}
