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
} from "@repo/common";

interface UseCanvasSyncOptions {
  roomId: number;
  state: CanvasState | null;
  enabled?: boolean;
}

export function useCanvasSync({
  roomId,
  state,
  enabled = true,
}: UseCanvasSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const syncStateRef = useRef<RoomSyncState>({ roomId, version: 0, shapes: [] });
  const pendingSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const WS_BACKEND_URL =
    typeof window !== "undefined"
      ? `ws://${window.location.hostname}:8080`
      : "ws://localhost:8080";

  // Send snapshot to server with throttling
  const sendCanvasSnapshot = useCallback(
    (shapes: Shape[], version: number) => {
      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
      }

      pendingSyncRef.current = setTimeout(() => {
        if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN &&
          !isApplyingRemoteRef.current
        ) {
          const message: WsMessage = {
            type: "canvas_snapshot",
            roomId,
            version,
            shapes,
          };
          wsRef.current.send(JSON.stringify(message));
        }
      }, 300); // Throttle to 300ms to batch changes
    },
    [roomId]
  );

  // Subscribe to local canvas changes
  useEffect(() => {
    if (!enabled || !state) return;

    const unsubscribe = state.subscribe((shapes) => {
      // Only send if we're connected and not applying a remote update
      if (
        isConnectedRef.current &&
        !isApplyingRemoteRef.current &&
        wsRef.current?.readyState === WebSocket.OPEN
      ) {
        sendCanvasSnapshot(shapes, syncStateRef.current.version);
      }
    });

    return () => {
      unsubscribe();
      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
      }
    };
  }, [state, enabled, sendCanvasSnapshot]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enabled || !state) return;

    const ws = new WebSocket(WS_BACKEND_URL);

    ws.onopen = () => {
      console.log("[WS] Connected, joining room", roomId);
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
          isConnectedRef.current = true;
          setIsConnected(true);

          // Hydrate local state with server shapes
          isApplyingRemoteRef.current = true;
          state.hydrateShapes(message.shapes);
          isApplyingRemoteRef.current = false;
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
        } else if (message.type === "sync_error") {
          console.warn("[WS] Sync error:", message.reason);

          // On version mismatch, server will push latest state via room_joined
        }
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
      isConnectedRef.current = false;
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      isConnectedRef.current = false;
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [roomId, enabled, WS_BACKEND_URL, state]);

  return {
    isConnected,
    syncVersion: syncStateRef.current.version,
  };
}
