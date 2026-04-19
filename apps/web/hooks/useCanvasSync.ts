/**
 * useCanvasSync
 * 
 * Manages bidirectional WebSocket sync between canvas state and server.
 * 
 * - On component mount: join room, receive sync_init
 * - On local changes: throttle-send canvas_snapshot
 * - On remote updates: hydrate state without notification loop
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { CanvasState, Shape } from "@repo/canvas-engine";
import type {
  WsMessage,
  ServerMessage,
  RoomSyncState,
  RoomPresenceState,
} from "@repo/common";
import type {Tool} from "@repo/canvas-engine";
import {HTTP_BACKEND} from "../config";

interface UseCanvasSyncOptions {
  roomId: number;
  state: CanvasState | null;
  enabled?: boolean;
  /** Local selection IDs mirrored to collaborators as presence state. */
  localSelectionIds: string[];
  /** Current local tool used to describe what the user is making. */
  localTool: Tool;
}

/**
 * Synchronizes canvas state and room presence with the websocket backend.
 */
export function useCanvasSync({
  roomId,
  state,
  enabled = true,
  localSelectionIds,
  localTool,
}: UseCanvasSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [presenceState, setPresenceState] = useState<RoomPresenceState>({
    roomId,
    connectedUsersCount: 0,
    presences: [],
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const hasJoinedRoomRef = useRef(false);
  const syncStateRef = useRef<RoomSyncState>({ roomId, version: 0, shapes: [] });
  const pendingSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPresenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightSnapshotRef = useRef(false);
  const queuedSnapshotRef = useRef<Shape[] | null>(null);

  const WS_BACKEND_URL =
    typeof window !== "undefined"
      ? (() => {
          const backendHttpUrl = new URL(HTTP_BACKEND);
          const wsProtocol = backendHttpUrl.protocol === "https:" ? "wss:" : "ws:";
          return `${wsProtocol}//${backendHttpUrl.hostname}:8080`;
        })()
      : "ws://localhost:8080";

  const flushQueuedSnapshot = useCallback(() => {
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      !hasJoinedRoomRef.current ||
      isApplyingRemoteRef.current ||
      inFlightSnapshotRef.current
    ) {
      return;
    }

    const queuedShapes = queuedSnapshotRef.current;
    if (!queuedShapes) {
      return;
    }

    queuedSnapshotRef.current = null;
    inFlightSnapshotRef.current = true;

    const message: WsMessage = {
      type: "canvas_snapshot",
      roomId,
      version: syncStateRef.current.version,
      shapes: queuedShapes,
    };

    wsRef.current.send(JSON.stringify(message));
  }, [roomId]);

  // Queue latest snapshot and send when no snapshot is currently in flight.
  const sendCanvasSnapshot = useCallback(
    (shapes: Shape[]) => {
      queuedSnapshotRef.current = shapes;

      const shouldSendImmediately =
        hasJoinedRoomRef.current &&
        !inFlightSnapshotRef.current &&
        shapes.length !== syncStateRef.current.shapes.length;

      if (shouldSendImmediately) {
        flushQueuedSnapshot();
        return;
      }

      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
      }

      pendingSyncRef.current = setTimeout(() => {
        flushQueuedSnapshot();
      }, 160);
    },
    [flushQueuedSnapshot]
  );

  /**
   * Sends local selection/tool state to the room presence channel.
   */
  const sendPresenceSnapshot = useCallback(() => {
    if (pendingPresenceRef.current) {
      clearTimeout(pendingPresenceRef.current);
    }

    pendingPresenceRef.current = setTimeout(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !isConnectedRef.current) {
        return;
      }

      const message: WsMessage = {
        type: "update_presence",
        roomId,
        cursor: null,
        selectedIds: localSelectionIds,
        tool: localTool,
      };

      wsRef.current.send(JSON.stringify(message));
    }, 80);
  }, [localSelectionIds, localTool, roomId]);

  // Subscribe to local canvas changes.
  useEffect(() => {
    if (!enabled || !state) return;

    const unsubscribe = state.subscribe((shapes) => {
      // Only send if we're connected and not applying a remote update
      if (!isApplyingRemoteRef.current) {
        // Refresh presence while edits are happening so remote activity expires naturally when edits stop.
        sendPresenceSnapshot();
        sendCanvasSnapshot(shapes);
      }
    });

    return () => {
      unsubscribe();
      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
      }
    };
  }, [state, enabled, sendCanvasSnapshot, sendPresenceSnapshot]);

  useEffect(() => {
    if (!enabled || !state) return;

    if (!isConnectedRef.current || !currentUserId) {
      return;
    }

    sendPresenceSnapshot();

    return () => {
      if (pendingPresenceRef.current) {
        clearTimeout(pendingPresenceRef.current);
      }
    };
  }, [enabled, state, currentUserId, localSelectionIds, sendPresenceSnapshot]);

  // Initialize WebSocket connection.
  useEffect(() => {
    if (!enabled || !state) return;

    const ws = new WebSocket(WS_BACKEND_URL);

    ws.onopen = () => {
      console.log("[WS] Connected, joining room", roomId);
      setLastSyncError(null);
      hasJoinedRoomRef.current = false;
      isConnectedRef.current = true;
      setIsConnected(true);
      const joinMsg: WsMessage = { type: "join_room", roomId };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;

        if (message.type === "room_joined") {
          console.log(
            "[WS] Joined room, version:",
            message.version,
            "shapes:",
            message.shapes.length
          );
          syncStateRef.current = {
            roomId: message.roomId,
            version: message.version,
            shapes: message.shapes,
          };
          hasJoinedRoomRef.current = true;
          inFlightSnapshotRef.current = false;
          setCurrentUserId(message.userId);
          setPresenceState({
            roomId: message.roomId,
            connectedUsersCount: message.connectedUsersCount,
            presences: message.presences,
          });
          setLastSyncError(null);
          isConnectedRef.current = true;
          setIsConnected(true);

          // Hydrate local state with server shapes
          isApplyingRemoteRef.current = true;
          state.hydrateShapes(message.shapes);
          isApplyingRemoteRef.current = false;

          // If edits happened while awaiting ack, send latest queued snapshot now.
          flushQueuedSnapshot();
        } else if (message.type === "canvas_snapshot_broadcast") {
          console.log(
            "[WS] Received snapshot from",
            message.senderId,
            "version:",
            message.version
          );

          // Update local sync state
          syncStateRef.current = {
            roomId: message.roomId,
            version: message.version,
            shapes: message.shapes,
          };

          // Apply remote update
          isApplyingRemoteRef.current = true;
          state.hydrateShapes(message.shapes);
          isApplyingRemoteRef.current = false;
        } else if (message.type === "canvas_snapshot_ack") {
          syncStateRef.current = {
            roomId: message.roomId,
            version: message.version,
            shapes: syncStateRef.current.shapes,
          };
          inFlightSnapshotRef.current = false;
          setLastSyncError(null);
          flushQueuedSnapshot();
        } else if (message.type === "room_presence_state") {
          setPresenceState({
            roomId: message.roomId,
            connectedUsersCount: message.connectedUsersCount,
            presences: message.presences,
          });
        } else if (message.type === "sync_error") {
          console.warn("[WS] Sync error:", message.reason);
          setLastSyncError(message.reason);
          inFlightSnapshotRef.current = false;

          // Drop stale queued snapshots after version drift to avoid replaying old state
          // over the authoritative server snapshot that follows.
          if (message.reason.toLowerCase().includes("version mismatch")) {
            queuedSnapshotRef.current = null;
            if (pendingSyncRef.current) {
              clearTimeout(pendingSyncRef.current);
              pendingSyncRef.current = null;
            }
          }

          // On version mismatch, server will push latest state via room_joined
        }
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    };

    ws.onerror = () => {
      console.warn("[WS] WebSocket connection error");
      setLastSyncError("WebSocket connection error");
      hasJoinedRoomRef.current = false;
      isConnectedRef.current = false;
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.log("[WS] Disconnected");
      if (event.code === 1008) {
        setLastSyncError(event.reason || "WebSocket authentication failed");
      }
      hasJoinedRoomRef.current = false;
      isConnectedRef.current = false;
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      // Flush the latest local snapshot before closing socket so refresh/navigation
      // does not drop edits still waiting in the throttle window.
      if (
        isConnectedRef.current &&
        ws.readyState === WebSocket.OPEN &&
        state &&
        !isApplyingRemoteRef.current
      ) {
        try {
          const latestShapes = state.getShapes();
          const message: WsMessage = {
            type: "canvas_snapshot",
            roomId,
            version: syncStateRef.current.version,
            shapes: latestShapes,
          };
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.warn("[WS] Failed to flush snapshot during cleanup", error);
        }
      }

      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
      }
      if (pendingPresenceRef.current) {
        clearTimeout(pendingPresenceRef.current);
      }
      inFlightSnapshotRef.current = false;
      queuedSnapshotRef.current = null;
      hasJoinedRoomRef.current = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [roomId, enabled, WS_BACKEND_URL, state, flushQueuedSnapshot]);

  return {
    isConnected,
    syncVersion: syncStateRef.current.version,
    lastSyncError,
    presenceState,
    connectedUsersCount: presenceState.connectedUsersCount,
    currentUserId,
  };
}
