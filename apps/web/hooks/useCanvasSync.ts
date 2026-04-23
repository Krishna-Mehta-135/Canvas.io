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

const WS_SYNC_DEBUG = process.env.NEXT_PUBLIC_WS_SYNC_DEBUG === "true";
const SNAPSHOT_MIN_SEND_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_WS_SNAPSHOT_MIN_SEND_INTERVAL_MS ?? 16
);
const WS_MAX_IN_FLIGHT_SNAPSHOTS = Number(
  process.env.NEXT_PUBLIC_WS_MAX_IN_FLIGHT_SNAPSHOTS ?? 3
);
const REMOTE_HYDRATE_IDLE_GRACE_MS = Number(
  process.env.NEXT_PUBLIC_WS_REMOTE_HYDRATE_IDLE_GRACE_MS ?? 12
);

type PendingRemoteSnapshot = {
  roomId: number;
  version: number;
  shapes: Shape[];
  senderId?: string;
};

interface UseCanvasSyncOptions {
  roomId: number;
  state: CanvasState | null;
  enabled?: boolean;
  /** Local selection IDs mirrored to collaborators as presence state. */
  localSelectionIds: string[];
  /** Current local tool used to describe what the user is making. */
  localTool: Tool;
}

export type SyncTimelineEntry = {
  id: string;
  at: string;
  type: string;
  detail: string;
};

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
  const [websocketLatencyMs, setWebsocketLatencyMs] = useState<number | null>(null);
  const [inFlightSnapshotCount, setInFlightSnapshotCount] = useState(0);
  const [eventTimeline, setEventTimeline] = useState<SyncTimelineEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const hasJoinedRoomRef = useRef(false);
  const syncStateRef = useRef<RoomSyncState>({ roomId, version: 0, shapes: [] });
  const pendingSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncRafRef = useRef<number | null>(null);
  const pendingPresenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightSnapshotCountRef = useRef(0);
  const queuedSnapshotRef = useRef<Shape[] | null>(null);
  const snapshotSentAtRef = useRef<number | null>(null);
  const lastSnapshotSentAtRef = useRef(0);
  const optimisticSnapshotVersionRef = useRef(0);
  const lastLocalEditAtRef = useRef(0);
  const pendingRemoteSnapshotRef = useRef<PendingRemoteSnapshot | null>(null);
  const pendingRemoteHydrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteHydrateRafRef = useRef<number | null>(null);

  const appendTimelineEvent = useCallback((type: string, detail: string) => {
    if (!WS_SYNC_DEBUG) {
      return;
    }

    const now = new Date();
    const nextEvent: SyncTimelineEntry = {
      id: `${now.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
      at: now.toLocaleTimeString(),
      type,
      detail,
    };

    setEventTimeline((previous) => [...previous.slice(-59), nextEvent]);
  }, []);

  const syncInFlightCounter = useCallback(() => {
    const count = inFlightSnapshotCountRef.current + (queuedSnapshotRef.current ? 1 : 0);
    setInFlightSnapshotCount(count);
  }, []);

  const cancelScheduledRemoteHydrate = useCallback(() => {
    if (pendingRemoteHydrateTimerRef.current) {
      clearTimeout(pendingRemoteHydrateTimerRef.current);
      pendingRemoteHydrateTimerRef.current = null;
    }

    if (remoteHydrateRafRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(remoteHydrateRafRef.current);
      remoteHydrateRafRef.current = null;
    }
  }, []);

  const cancelScheduledSnapshotFlush = useCallback(() => {
    if (pendingSyncRef.current) {
      clearTimeout(pendingSyncRef.current);
      pendingSyncRef.current = null;
    }

    if (pendingSyncRafRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(pendingSyncRafRef.current);
      pendingSyncRafRef.current = null;
    }
  }, []);

  const scheduleRemoteHydrate = useCallback(() => {
    if (!state) {
      return;
    }

    cancelScheduledRemoteHydrate();

    const applyLatestRemoteSnapshot = () => {
      const pending = pendingRemoteSnapshotRef.current;
      if (!pending) {
        return;
      }

      const sinceLastLocalEditMs = Date.now() - lastLocalEditAtRef.current;
      if (sinceLastLocalEditMs < REMOTE_HYDRATE_IDLE_GRACE_MS) {
        const waitMs = Math.max(1, REMOTE_HYDRATE_IDLE_GRACE_MS - sinceLastLocalEditMs);
        pendingRemoteHydrateTimerRef.current = setTimeout(() => {
          scheduleRemoteHydrate();
        }, waitMs);
        return;
      }

      pendingRemoteSnapshotRef.current = null;
      syncStateRef.current = {
        roomId: pending.roomId,
        version: pending.version,
        shapes: pending.shapes,
      };

      isApplyingRemoteRef.current = true;
      state.hydrateShapes(pending.shapes);
      isApplyingRemoteRef.current = false;

      appendTimelineEvent(
        "snapshot_broadcast",
        `v${pending.version}${pending.senderId ? ` from ${pending.senderId}` : ""}`
      );
    };

    if (typeof window === "undefined") {
      applyLatestRemoteSnapshot();
      return;
    }

    remoteHydrateRafRef.current = window.requestAnimationFrame(() => {
      remoteHydrateRafRef.current = null;
      applyLatestRemoteSnapshot();
    });
  }, [appendTimelineEvent, cancelScheduledRemoteHydrate, state]);

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
      inFlightSnapshotCountRef.current >= WS_MAX_IN_FLIGHT_SNAPSHOTS
    ) {
      return;
    }

    const now = Date.now();
    const elapsedSinceLastSend = now - lastSnapshotSentAtRef.current;
    if (elapsedSinceLastSend < SNAPSHOT_MIN_SEND_INTERVAL_MS) {
      return;
    }

    const queuedShapes = queuedSnapshotRef.current;
    if (!queuedShapes) {
      syncInFlightCounter();
      return;
    }

    const messageVersion = optimisticSnapshotVersionRef.current;
    optimisticSnapshotVersionRef.current += 1;

    queuedSnapshotRef.current = null;
    inFlightSnapshotCountRef.current += 1;
    snapshotSentAtRef.current = Date.now();
    lastSnapshotSentAtRef.current = snapshotSentAtRef.current;
    appendTimelineEvent("snapshot_send", `v${messageVersion} (${queuedShapes.length} shapes)`);
    syncInFlightCounter();

    const message: WsMessage = {
      type: "canvas_snapshot",
      roomId,
      version: messageVersion,
      shapes: queuedShapes,
    };

    wsRef.current.send(JSON.stringify(message));
  }, [appendTimelineEvent, roomId, syncInFlightCounter]);

  const scheduleSnapshotFlush = useCallback(() => {
    if (pendingSyncRafRef.current !== null || typeof window === "undefined") {
      return;
    }

    const tick = () => {
      pendingSyncRafRef.current = null;

      const hadQueuedSnapshot = Boolean(queuedSnapshotRef.current);
      flushQueuedSnapshot();

      if (queuedSnapshotRef.current && hadQueuedSnapshot) {
        pendingSyncRafRef.current = window.requestAnimationFrame(tick);
      }
    };

    pendingSyncRafRef.current = window.requestAnimationFrame(tick);
  }, [flushQueuedSnapshot]);

  // Queue latest snapshot and send when no snapshot is currently in flight.
  const sendCanvasSnapshot = useCallback(
    (shapes: Shape[]) => {
      queuedSnapshotRef.current = shapes;
      syncInFlightCounter();

      cancelScheduledSnapshotFlush();

      // If no request is currently in flight and throttle budget allows,
      // flush immediately to avoid adding an extra timer hop to every edit.
      const canFlushNow =
        inFlightSnapshotCountRef.current < WS_MAX_IN_FLIGHT_SNAPSHOTS &&
        Date.now() - lastSnapshotSentAtRef.current >= SNAPSHOT_MIN_SEND_INTERVAL_MS;
      if (canFlushNow) {
        flushQueuedSnapshot();
        return;
      }

      scheduleSnapshotFlush();
    },
    [cancelScheduledSnapshotFlush, flushQueuedSnapshot, scheduleSnapshotFlush, syncInFlightCounter]
  );

  /**
   * Sends local selection/tool state to the room presence channel.
   */
  const sendPresenceSnapshot = useCallback(() => {
    if (pendingPresenceRef.current) {
      clearTimeout(pendingPresenceRef.current);
    }

    pendingPresenceRef.current = setTimeout(() => {
      if (
        !wsRef.current ||
        wsRef.current.readyState !== WebSocket.OPEN ||
        !isConnectedRef.current ||
        !hasJoinedRoomRef.current
      ) {
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
        lastLocalEditAtRef.current = Date.now();
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
      if (WS_SYNC_DEBUG) {
        console.log("[WS] Connected, joining room", roomId);
      }
      appendTimelineEvent("socket_open", `joining room ${roomId}`);
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
          if (WS_SYNC_DEBUG) {
            console.log(
              "[WS] Joined room, version:",
              message.version,
              "shapes:",
              message.shapes.length
            );
          }
          syncStateRef.current = {
            roomId: message.roomId,
            version: message.version,
            shapes: message.shapes,
          };
          optimisticSnapshotVersionRef.current = message.version;
          hasJoinedRoomRef.current = true;
          inFlightSnapshotCountRef.current = 0;
          setCurrentUserId(message.userId);
          setPresenceState({
            roomId: message.roomId,
            connectedUsersCount: message.connectedUsersCount,
            presences: message.presences,
          });
          setLastSyncError(null);
          isConnectedRef.current = true;
          setIsConnected(true);
          appendTimelineEvent("room_joined", `v${message.version} (${message.shapes.length} shapes)`);
          syncInFlightCounter();

          // Hydrate local state with server shapes
          pendingRemoteSnapshotRef.current = null;
          cancelScheduledRemoteHydrate();
          isApplyingRemoteRef.current = true;
          state.hydrateShapes(message.shapes);
          isApplyingRemoteRef.current = false;

          // If edits happened while awaiting ack, send latest queued snapshot now.
          flushQueuedSnapshot();
        } else if (message.type === "canvas_snapshot_broadcast") {
          if (WS_SYNC_DEBUG) {
            console.log(
              "[WS] Received snapshot from",
              message.senderId,
              "version:",
              message.version
            );
          }

          // Keep only the latest remote snapshot and hydrate on animation frame
          // once local editing activity settles.
          pendingRemoteSnapshotRef.current = {
            roomId: message.roomId,
            version: message.version,
            shapes: message.shapes,
            senderId: message.senderId,
          };
          scheduleRemoteHydrate();
        } else if (message.type === "canvas_snapshot_ack") {
          syncStateRef.current = {
            roomId: message.roomId,
            version: message.version,
            shapes: syncStateRef.current.shapes,
          };
          inFlightSnapshotCountRef.current = Math.max(0, inFlightSnapshotCountRef.current - 1);
          optimisticSnapshotVersionRef.current = Math.max(optimisticSnapshotVersionRef.current, message.version + 1);
          if (snapshotSentAtRef.current !== null) {
            const latency = Math.max(0, Date.now() - snapshotSentAtRef.current);
            setWebsocketLatencyMs(latency);
            appendTimelineEvent("snapshot_ack", `v${message.version} (${latency}ms)`);
            snapshotSentAtRef.current = null;
          } else {
            appendTimelineEvent("snapshot_ack", `v${message.version}`);
          }
          syncInFlightCounter();
          setLastSyncError(null);
          scheduleSnapshotFlush();
        } else if (message.type === "room_presence_state") {
          setPresenceState({
            roomId: message.roomId,
            connectedUsersCount: message.connectedUsersCount,
            presences: message.presences,
          });
        } else if (message.type === "sync_error") {
          if (WS_SYNC_DEBUG) {
            console.warn("[WS] Sync error:", message.reason);
          }
          appendTimelineEvent("sync_error", message.reason);
          const reasonLower = message.reason.toLowerCase();
          const isTransientSyncError =
            reasonLower.includes("version mismatch") ||
            reasonLower.includes("rate limit") ||
            (!hasJoinedRoomRef.current &&
              (reasonLower.includes("forbidden") || reasonLower.includes("not active")));
          if (!isTransientSyncError) {
            setLastSyncError(message.reason);
          }
          inFlightSnapshotCountRef.current = 0;
          syncInFlightCounter();

          // Drop stale queued snapshots after version drift to avoid replaying old state
          // over the authoritative server snapshot that follows.
          if (message.reason.toLowerCase().includes("version mismatch")) {
            inFlightSnapshotCountRef.current = 0;
            queuedSnapshotRef.current = null;
            if (pendingSyncRef.current) {
              clearTimeout(pendingSyncRef.current);
              pendingSyncRef.current = null;
            }
            return;
          }

          // For transient errors (for example rate limits), immediately retry
          // the latest queued snapshot rather than waiting for a future local edit.
          scheduleSnapshotFlush();

          // On version mismatch, server will push latest state via room_joined
        }
      } catch (err) {
        if (WS_SYNC_DEBUG) {
          console.error("[WS] Failed to parse message:", err);
        }
      }
    };

    ws.onerror = () => {
      if (WS_SYNC_DEBUG) {
        console.warn("[WS] WebSocket connection error");
      }
      appendTimelineEvent("socket_error", "websocket connection error");
      // Keep connection status unchanged here. Some browsers emit error before close,
      // and toggling to disconnected causes noisy UI flicker.
      setLastSyncError("WebSocket connection error");
    };

    ws.onclose = (event) => {
      if (WS_SYNC_DEBUG) {
        console.log("[WS] Disconnected");
      }
      appendTimelineEvent("socket_close", event.reason || `code ${event.code}`);
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
          if (WS_SYNC_DEBUG) {
            console.warn("[WS] Failed to flush snapshot during cleanup", error);
          }
        }
      }

      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
      }
      if (pendingSyncRafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(pendingSyncRafRef.current);
        pendingSyncRafRef.current = null;
      }
      if (pendingPresenceRef.current) {
        clearTimeout(pendingPresenceRef.current);
      }
      cancelScheduledRemoteHydrate();
      pendingRemoteSnapshotRef.current = null;
      inFlightSnapshotCountRef.current = 0;
      queuedSnapshotRef.current = null;
      snapshotSentAtRef.current = null;
      lastSnapshotSentAtRef.current = 0;
      optimisticSnapshotVersionRef.current = 0;
      syncInFlightCounter();
      hasJoinedRoomRef.current = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [
    roomId,
    enabled,
    WS_BACKEND_URL,
    state,
    flushQueuedSnapshot,
    scheduleSnapshotFlush,
    appendTimelineEvent,
    syncInFlightCounter,
    cancelScheduledRemoteHydrate,
    scheduleRemoteHydrate,
  ]);

  return {
    isConnected,
    syncVersion: syncStateRef.current.version,
    lastSyncError,
    presenceState,
    connectedUsersCount: presenceState.connectedUsersCount,
    currentUserId,
    websocketLatencyMs,
    inFlightSnapshotCount,
    eventTimeline,
  };
}
