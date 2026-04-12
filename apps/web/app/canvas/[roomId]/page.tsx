"use client";

import {ReactNode, useEffect, useRef, useState} from "react";
import {useParams} from "next/navigation";
import axios, {AxiosError} from "axios";
import {attachEvents} from "@repo/canvas-engine";
import {CanvasState} from "@repo/canvas-engine";
import type {Shape, Tool} from "@repo/canvas-engine";
import {HTTP_BACKEND} from "../../../config";
import {ThemeToggle, useTheme} from "../../components/ThemeToggle";
import {useCanvasSync} from "../../../hooks/useCanvasSync";

const TOOLS: Array<{id: Tool; label: string; shortcut: string; icon: ReactNode}> = [
    {
        id: "select",
        label: "Select",
        shortcut: "V",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 3l11 7-5 1 3 7-2 1-3-7-4 4z" />
            </svg>
        ),
    },
    {
        id: "rect",
        label: "Rectangle",
        shortcut: "1",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="6" width="16" height="12" rx="1" />
            </svg>
        ),
    },
    {
        id: "circle",
        label: "Ellipse",
        shortcut: "2",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="12" rx="8" ry="6" />
            </svg>
        ),
    },
    {
        id: "line",
        label: "Line",
        shortcut: "3",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 18L19 6" />
            </svg>
        ),
    },
    {
        id: "arrow",
        label: "Arrow",
        shortcut: "A",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 18L18 6" />
                <path d="M12 6h6v6" />
            </svg>
        ),
    },
    {
        id: "text",
        label: "Text",
        shortcut: "4",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16" />
                <path d="M12 6v12" />
            </svg>
        ),
    },
    {
        id: "freehand",
        label: "Freehand",
        shortcut: "5",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 16c3-8 8 4 12-4 1-2 3-2 6 0" />
            </svg>
        ),
    },
];

export default function CanvasPage() {
    const params = useParams<{roomId: string}>();
    const roomId = Array.isArray(params?.roomId) ? params.roomId[0] : params?.roomId;

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const controlsRef = useRef<ReturnType<typeof attachEvents> | null>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestShapesRef = useRef<Shape[]>([]);
    const isHydratingRef = useRef(true);
    const isRoomMissingRef = useRef(false);
    const resolvedRoomIdRef = useRef<number | null>(null);

    const toolRef = useRef<Tool>("select");
    const [activeTool, setActiveTool] = useState<Tool>("select");
    const [selectedCount, setSelectedCount] = useState(0);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
    const stateRef = useRef<CanvasState | null>(null);
    const [canvasState, setCanvasState] = useState<CanvasState | null>(null);
    const [resolvedRoomId, setResolvedRoomId] = useState<number | null>(null);
    const {theme} = useTheme();
    const isDark = theme === "dark";

    useEffect(() => {
        toolRef.current = activeTool;
    }, [activeTool]);

    useEffect(() => {
        controlsRef.current?.rerender();
    }, [theme]);

    useEffect(() => {
        if (!roomId) return;

        isHydratingRef.current = true;
        isRoomMissingRef.current = false;
        resolvedRoomIdRef.current = null;
        setResolvedRoomId(null);
        setInviteLink(null);
        let isUnmounted = false;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // set size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const state = new CanvasState();
        stateRef.current = state;
        setCanvasState(state);

        const getShapesById = async (id: number) => {
            const response = await axios.get(`${HTTP_BACKEND}/room/${id}/shapes`, {
                withCredentials: true,
            });

            const persistedShapes = response.data?.data;
            return Array.isArray(persistedShapes) ? (persistedShapes as Shape[]) : [];
        };

        const resolveRoomIdAndShapes = async (): Promise<{resolvedRoomId: number; shapes: Shape[]}> => {
            const requestedSlug = roomId.trim();
            const isSlugValid = requestedSlug.length >= 3 && requestedSlug.length <= 20;
            const effectiveSlug = isSlugValid
                ? requestedSlug
                : crypto.randomUUID().replace(/-/g, "").slice(0, 12);

            if (!isSlugValid) {
                window.history.replaceState(null, "", `/canvas/${effectiveSlug}`);
            }

            try {
                const roomBySlug = await axios.get(`${HTTP_BACKEND}/room/room/slug/${encodeURIComponent(effectiveSlug)}`, {
                    withCredentials: true,
                });

                const resolvedRoomId = Number(roomBySlug.data?.data?.id);
                if (!Number.isFinite(resolvedRoomId)) {
                    throw new Error("Invalid room id returned from slug lookup");
                }

                const shapes = await getShapesById(resolvedRoomId);

                return {
                    resolvedRoomId,
                    shapes,
                };
            } catch (error) {
                const axiosError = error as AxiosError<{message?: string}>;
                if (axiosError.response?.status !== 404) {
                    throw error;
                }

                try {
                    const createRoomResponse = await axios.post(
                        `${HTTP_BACKEND}/room`,
                        {slug: effectiveSlug},
                        {withCredentials: true}
                    );

                    const resolvedRoomId = Number(createRoomResponse.data?.data?.id);
                    if (!Number.isFinite(resolvedRoomId)) {
                        throw new Error("Invalid room id returned while creating room");
                    }

                    return {
                        resolvedRoomId,
                        shapes: [],
                    };
                } catch (createError) {
                    const createAxiosError = createError as AxiosError<{message?: string}>;
                    if (createAxiosError.response?.status !== 409) {
                        throw createError;
                    }

                    const roomBySlug = await axios.get(
                        `${HTTP_BACKEND}/room/room/slug/${encodeURIComponent(effectiveSlug)}`,
                        {
                            withCredentials: true,
                        }
                    );

                    const resolvedRoomId = Number(roomBySlug.data?.data?.id);
                    if (!Number.isFinite(resolvedRoomId)) {
                        throw new Error("Invalid room id returned from slug lookup");
                    }

                    const shapes = await getShapesById(resolvedRoomId);

                    return {
                        resolvedRoomId,
                        shapes,
                    };
                }
            }
        };

        const persistShapes = async (shapes: Shape[]) => {
            latestShapesRef.current = shapes;

            if (isHydratingRef.current) {
                return;
            }

            if (isRoomMissingRef.current) {
                return;
            }

            if (resolvedRoomIdRef.current === null) {
                return;
            }

            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = setTimeout(async () => {
                try {
                    await axios.put(
                        `${HTTP_BACKEND}/room/${resolvedRoomIdRef.current}/shapes`,
                        {
                            shapes: latestShapesRef.current,
                        },
                        {
                            withCredentials: true,
                        }
                    );
                } catch (error) {
                    const axiosError = error as AxiosError<{message?: string}>;
                    if (axiosError.response?.status === 404) {
                        isRoomMissingRef.current = true;
                        console.warn("Persistence disabled: room was not found.");
                        return;
                    }

                    console.error("Failed to save shapes", error);
                }
            }, 300);
        };

        // Subscribe the page (not shapes) to CanvasState updates.
        // The callback receives Shape[] as payload and schedules persistence.
        const unsubscribe = state.subscribe((shapes) => {
            // Ensure remote websocket updates repaint immediately without requiring focus.
            controlsRef.current?.rerender();
            void persistShapes(shapes);
        });

        const loadShapes = async () => {
            try {
                const {resolvedRoomId, shapes} = await resolveRoomIdAndShapes();
                resolvedRoomIdRef.current = resolvedRoomId;
                setResolvedRoomId(resolvedRoomId);

                if (!isUnmounted) {
                    state.hydrateShapes(shapes);
                }
            } catch (error) {
                const axiosError = error as AxiosError<{message?: string}>;
                if (axiosError.response?.status === 404) {
                    isRoomMissingRef.current = true;
                    return;
                }

                console.error("Failed to load shapes", error);
            } finally {
                isHydratingRef.current = false;
            }
        };

        const initializeCanvas = async () => {
            await loadShapes();

            if (isUnmounted) {
                return;
            }

            controlsRef.current = attachEvents(canvas, ctx, state, {
                getTool: () => toolRef.current,
                onToolChange: (tool) => {
                    toolRef.current = tool;
                    setActiveTool(tool);
                },
                onSelectionChange: (selectedIds) => {
                    setSelectedCount(selectedIds.length);
                },
            });
        };

        void initializeCanvas();

        return () => {
            isUnmounted = true;

            // Stop listening to state updates when this page unmounts.
            // Without this, a stale callback could keep firing saves.
            unsubscribe();

            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;

                if (!isRoomMissingRef.current && resolvedRoomIdRef.current !== null) {
                    void axios.put(
                        `${HTTP_BACKEND}/room/${resolvedRoomIdRef.current}/shapes`,
                        {
                            shapes: latestShapesRef.current,
                        },
                        {
                            withCredentials: true,
                        }
                    ).catch((error) => {
                        const axiosError = error as AxiosError<{message?: string}>;
                        if (axiosError.response?.status === 404 || axiosError.response?.status === 401) {
                            return;
                        }

                        console.error("Failed to flush shapes on unmount", error);
                    });
                }
            }
        };
    }, [roomId]);

    // Initialize WebSocket sync when state and room are ready
    const syncResult = useCanvasSync({
        roomId: resolvedRoomId ?? 0,
        state: canvasState,
        enabled: canvasState !== null && resolvedRoomId !== null,
    });

    useEffect(() => {
        setSyncStatus(syncResult.isConnected ? "connected" : "disconnected");
    }, [syncResult.isConnected]);

    // Fetch and display invite link
    useEffect(() => {
        if (resolvedRoomId === null) return;

        const fetchInviteLink = async () => {
            try {
                const response = await axios.get(
                    `${HTTP_BACKEND}/room/${resolvedRoomId}/invite`,
                    {
                        withCredentials: true,
                    }
                );
                const link = response.data?.data?.inviteLink;
                console.log("[Invite] Fetched invite link:", link);
                setInviteLink(link || `${window.location.origin}/canvas/${roomId}`);
            } catch (error) {
                console.error("Failed to fetch invite link:", error);
                // Fallback: use current room slug as invite link
                setInviteLink(`${window.location.origin}/canvas/${roomId}`);
            }
        };

        void fetchInviteLink();
    }, [roomId, resolvedRoomId]);

    const handleDeleteSelected = () => {
        controlsRef.current?.deleteSelection();
    };

    const handleCopyInvite = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink).then(() => {
                alert("Invite link copied to clipboard!");
            });
        }
    };

    return (
        <div className={`relative h-screen w-screen ${isDark ? "bg-[#121212]" : "bg-[#eef2f7]"}`}>
            <div className="absolute right-4 top-4 z-20">
                <ThemeToggle />
            </div>
            <div
                className={`absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-2xl p-2 backdrop-blur ${
                    isDark
                        ? "border border-white/10 bg-[#191919]/95 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
                        : "border border-slate-300/70 bg-white/90 shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
                }`}
            >
                <div className="flex items-center gap-1">
                    {TOOLS.map((tool) => {
                        const isActive = activeTool === tool.id;

                        return (
                            <button
                                key={tool.id}
                                type="button"
                                onClick={() => setActiveTool(tool.id)}
                                title={`${tool.label} (${tool.shortcut})`}
                                className={`group flex min-w-14 flex-col items-center rounded-xl border px-2 py-1.5 transition ${
                                    isActive
                                        ? isDark
                                            ? "border-[#8d8ac5] bg-[#8d8ac5]/20 text-white"
                                            : "border-blue-300 bg-blue-50 text-slate-900"
                                        : isDark
                                            ? "border-transparent bg-[#232323] text-white/85 hover:border-white/20 hover:text-white"
                                            : "border-transparent bg-slate-100 text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                }`}
                            >
                                {tool.icon}
                                <span
                                    className={`mt-1 text-[10px] ${
                                        isActive
                                            ? isDark
                                                ? "text-white/90"
                                                : "text-slate-700"
                                            : isDark
                                                ? "text-white/55"
                                                : "text-slate-500"
                                    }`}
                                >
                                    {tool.shortcut}
                                </span>
                            </button>
                        );
                    })}
                    <div className={`mx-1 h-8 w-px ${isDark ? "bg-white/10" : "bg-slate-300"}`} />
                    <button
                        type="button"
                        onClick={handleDeleteSelected}
                        disabled={selectedCount === 0}
                        title="Delete selected shapes (Delete/Backspace)"
                        className={`group flex min-w-14 flex-col items-center rounded-xl border px-2 py-1.5 transition ${
                            selectedCount > 0
                                ? isDark
                                    ? "border-red-300/30 bg-red-500/15 text-white hover:border-red-200/50 hover:bg-red-500/20"
                                    : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                : isDark
                                    ? "cursor-not-allowed border-transparent bg-[#232323] text-white/40"
                                    : "cursor-not-allowed border-transparent bg-slate-100 text-slate-400"
                        }`}
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                        </svg>
                        <span
                            className={`mt-1 text-[10px] ${
                                selectedCount > 0
                                    ? isDark
                                        ? "text-white/80"
                                        : "text-red-700"
                                    : isDark
                                        ? "text-white/35"
                                        : "text-slate-400"
                            }`}
                        >
                            Del
                        </span>
                    </button>
                </div>
            </div>

            {/* Sync Status and Invite Link */}
            <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
                {/* Sync Status Indicator */}
                <div
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                        syncStatus === "connected"
                            ? isDark
                                ? "bg-green-500/20 text-green-300"
                                : "bg-green-100 text-green-700"
                            : isDark
                                ? "bg-yellow-500/20 text-yellow-300"
                                : "bg-yellow-100 text-yellow-700"
                    }`}
                >
                    <div
                        className={`h-2 w-2 rounded-full ${
                            syncStatus === "connected" ? "bg-green-500" : "bg-yellow-500"
                        }`}
                    />
                    {syncStatus === "connected" ? "Connected" : "Connecting..."}
                </div>

                {/* Invite Link Button */}
                {inviteLink && (
                    <button
                        type="button"
                        onClick={handleCopyInvite}
                        title="Copy invite link"
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            isDark
                                ? "border-blue-300/30 bg-blue-500/15 text-blue-300 hover:border-blue-200/50 hover:bg-blue-500/20"
                                : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                        </svg>
                        Invite
                    </button>
                )}
            </div>

            <canvas ref={canvasRef} />
        </div>
    );
}
