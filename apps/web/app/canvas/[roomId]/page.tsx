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

const STYLE_SWATCHES = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#ffffff"];
const FILL_STYLE_OPTIONS: Array<{value: NonNullable<Shape["fillStyle"]>; label: string}> = [
    {value: "solid", label: "Solid"},
    {value: "hachure", label: "Hachure"},
    {value: "cross-hatch", label: "Cross Hatch"},
    {value: "dots", label: "Dots"},
];
const STROKE_STYLE_OPTIONS: Array<{value: NonNullable<Shape["strokeStyle"]>; label: string}> = [
    {value: "solid", label: "Solid"},
    {value: "dashed", label: "Dashed"},
    {value: "dotted", label: "Dotted"},
];
const DRAWING_PERSONAS = [
    {
        id: "architect",
        label: "Architect",
        roughness: 0,
        summary: "Crisp and precise strokes",
        examples: ["Blueprint", "Flowchart", "Wireframe"],
    },
    {
        id: "artist",
        label: "Artist",
        roughness: 1.2,
        summary: "Balanced hand-drawn feel",
        examples: ["Storyboard", "Sketch note", "Concept map"],
    },
    {
        id: "cartoonist",
        label: "Cartoonist",
        roughness: 3.4,
        summary: "Expressive and playful lines",
        examples: ["Comic panel", "Doodle scene", "Character board"],
    },
] as const;
const DEFAULT_ROUGHNESS_STORAGE_KEY = "canvas-default-roughness";

const TOOLS: Array<{id: Tool; label: string; shortcut: string; icon: ReactNode}> = [
    {
        id: "select",
        label: "Select",
        shortcut: "0",
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
        id: "rhombus",
        label: "Rhombus",
        shortcut: "3",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4l8 8-8 8-8-8z" />
            </svg>
        ),
    },
    {
        id: "line",
        label: "Line",
        shortcut: "4",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 18L19 6" />
            </svg>
        ),
    },
    {
        id: "arrow",
        label: "Arrow",
        shortcut: "5",
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
        shortcut: "6",
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
        shortcut: "7",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 16c3-8 8 4 12-4 1-2 3-2 6 0" />
            </svg>
        ),
    },
    {
        id: "eraser",
        label: "Eraser",
        shortcut: "8",
        icon: (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15.5l7.5-7.5a2 2 0 012.8 0l5.2 5.2-5.8 5.8H8.2l-4.2-4.2a2 2 0 010-2.8z" />
                <path d="M12.2 13.2l4.1 4.1" />
                <path d="M7.2 18.2h4.2" />
            </svg>
        ),
    },
];

type StoredViewport = {
    x: number;
    y: number;
    scale: number;
};

function getViewportStorageKey(roomKey: string) {
    return `canvas-viewport:${roomKey}`;
}

function loadStoredViewport(roomKey: string): StoredViewport | null {
    if (typeof window === "undefined") return null;

    try {
        const raw = window.localStorage.getItem(getViewportStorageKey(roomKey));
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<StoredViewport>;
        if (
            typeof parsed.x !== "number" ||
            typeof parsed.y !== "number" ||
            typeof parsed.scale !== "number" ||
            !Number.isFinite(parsed.x) ||
            !Number.isFinite(parsed.y) ||
            !Number.isFinite(parsed.scale)
        ) {
            return null;
        }

        return {
            x: parsed.x,
            y: parsed.y,
            scale: parsed.scale,
        };
    } catch {
        return null;
    }
}

function saveStoredViewport(roomKey: string, viewport: StoredViewport) {
    if (typeof window === "undefined") return;

    try {
        window.localStorage.setItem(getViewportStorageKey(roomKey), JSON.stringify(viewport));
    } catch {
        // Ignore storage failures; viewport persistence is best-effort.
    }
}

function FillStyleTile({
    value,
    selected,
    onClick,
    isDark,
}: {
    value: NonNullable<Shape["fillStyle"]>;
    selected: boolean;
    onClick: () => void;
    isDark: boolean;
}) {
    const base = "relative h-9 w-9 rounded-md border transition";
    const ring = selected
        ? "border-indigo-500 ring-2 ring-indigo-300 dark:border-indigo-300 dark:ring-indigo-700"
        : isDark
            ? "border-white/15 hover:border-white/30"
            : "border-slate-300 hover:border-slate-500";
    const bg = isDark ? "bg-[#1e1e1e]" : "bg-white";

    if (value === "solid") {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`${base} ${ring} ${isDark ? "bg-slate-200" : "bg-slate-700"}`}
                title="Solid"
            />
        );
    }

    if (value === "hachure") {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`${base} ${ring} ${bg}`}
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(45deg, rgba(15,23,42,0.55) 0 2px, transparent 2px 7px)",
                }}
                title="Hachure"
            />
        );
    }

    if (value === "cross-hatch") {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`${base} ${ring} ${bg}`}
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(45deg, rgba(15,23,42,0.55) 0 2px, transparent 2px 7px), repeating-linear-gradient(-45deg, rgba(15,23,42,0.45) 0 2px, transparent 2px 7px)",
                }}
                title="Cross Hatch"
            />
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={`${base} ${ring} ${bg}`}
            style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, rgba(15,23,42,0.55) 1.4px, transparent 1.5px)",
                backgroundSize: "8px 8px",
            }}
            title="Dots"
        />
    );
}

function StrokeStyleTile({
    value,
    selected,
    onClick,
    isDark,
}: {
    value: NonNullable<Shape["strokeStyle"]>;
    selected: boolean;
    onClick: () => void;
    isDark: boolean;
}) {
    const border = selected
        ? "border-indigo-500 ring-2 ring-indigo-300 dark:border-indigo-300 dark:ring-indigo-700"
        : isDark
            ? "border-white/15 hover:border-white/30"
            : "border-slate-300 hover:border-slate-500";

    const dashArray = value === "dashed" ? "10 6" : value === "dotted" ? "2 6" : undefined;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`h-9 w-14 rounded-md border transition ${border} ${isDark ? "bg-[#1e1e1e]" : "bg-white"}`}
            title={value}
        >
            <svg viewBox="0 0 48 24" className="h-full w-full" fill="none">
                <line
                    x1="8"
                    y1="12"
                    x2="40"
                    y2="12"
                    className={isDark ? "stroke-slate-200" : "stroke-slate-700"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={dashArray}
                />
            </svg>
        </button>
    );
}

function PersonaExampleGlyph({example, isDark}: {example: string; isDark: boolean}) {
    const strokeClass = isDark ? "stroke-blue-100/90" : "stroke-blue-700";
    const fillClass = isDark ? "fill-blue-100/80" : "fill-blue-700/80";

    if (example === "Blueprint") {
        return (
            <svg viewBox="0 0 40 24" className={`h-7 w-full ${strokeClass}`} fill="none" strokeWidth="1.4" strokeLinecap="round">
                <path d="M4 4h32M4 8h32M4 12h32M4 16h32M4 20h32" className="opacity-35" />
                <rect x="8" y="6" width="24" height="12" rx="1.2" />
            </svg>
        );
    }

    if (example === "Flowchart") {
        return (
            <svg viewBox="0 0 40 24" className={`h-7 w-full ${strokeClass}`} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="10" height="7" rx="1" />
                <path d="M18 7l4 5-4 5-4-5z" />
                <rect x="27" y="8" width="10" height="7" rx="1" />
                <path d="M13 11.5h3M22 11.5h5" />
            </svg>
        );
    }

    if (example === "Wireframe") {
        return (
            <svg viewBox="0 0 40 24" className={`h-7 w-full ${strokeClass}`} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="32" height="18" rx="2" />
                <rect x="7" y="6" width="9" height="4" rx="1" />
                <path d="M18 7h15M18 10h8" />
                <rect x="7" y="12" width="26" height="6" rx="1" />
            </svg>
        );
    }

    if (example === "Storyboard") {
        return (
            <svg viewBox="0 0 40 24" className={`h-7 w-full ${strokeClass}`} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="10" height="7" rx="1" />
                <rect x="15" y="4" width="10" height="7" rx="1" />
                <rect x="27" y="4" width="10" height="7" rx="1" />
                <path d="M8 13v6M20 13v6M32 13v6" />
            </svg>
        );
    }

    if (example === "Sketch note") {
        return (
            <svg viewBox="0 0 40 24" className={`h-7 w-full ${strokeClass}`} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 16c3-7 7 3 11-2 2-2 4 2 8 1 4-1 8-6 13-2" />
                <path d="M6 6h11M6 9h8" className="opacity-65" />
            </svg>
        );
    }

    if (example === "Concept map") {
        return (
            <svg viewBox="0 0 40 24" className={`h-7 w-full ${strokeClass}`} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="20" cy="12" r="3.2" className={fillClass} />
                <circle cx="8" cy="7" r="2.4" />
                <circle cx="31" cy="7" r="2.4" />
                <circle cx="10" cy="18" r="2.4" />
                <circle cx="30" cy="18" r="2.4" />
                <path d="M17 10L10 8M23 10l6-2M17 14l-5 3M23 14l5 3" />
            </svg>
        );
    }

    if (example === "Comic panel") {
        return (
            <svg viewBox="0 0 40 24" className={`h-7 w-full ${strokeClass}`} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="34" height="18" rx="2" />
                <path d="M20 3v18" />
                <circle cx="11" cy="11" r="3" />
                <path d="M24 7h10M24 10h8M24 13h11" />
            </svg>
        );
    }

    if (example === "Doodle scene") {
        return (
            <svg viewBox="0 0 40 24" className={`h-7 w-full ${strokeClass}`} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 18h32" className="opacity-60" />
                <path d="M6 18l5-6 4 6" />
                <circle cx="18" cy="10" r="2.5" />
                <path d="M24 18c0-4 3-7 6-7s6 3 6 7" />
            </svg>
        );
    }

    if (example === "Character board") {
        return (
            <svg viewBox="0 0 40 24" className={`h-7 w-full ${strokeClass}`} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3" />
                <path d="M6 18c0-3 2-5 3-5s3 2 3 5" />
                <circle cx="20" cy="8" r="3" />
                <path d="M17 18c0-3 2-5 3-5s3 2 3 5" />
                <circle cx="31" cy="8" r="3" />
                <path d="M28 18c0-3 2-5 3-5s3 2 3 5" />
            </svg>
        );
    }

    return <div className={`h-7 w-full rounded-sm ${isDark ? "bg-blue-100/10" : "bg-blue-100"}`} />;
}

function PersonaButtonGlyph({personaId}: {personaId: string}) {
    if (personaId === "architect") {
        return (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="5" width="16" height="14" rx="1.5" />
                <path d="M4 10h16" />
                <path d="M10 5v14" />
            </svg>
        );
    }

    if (personaId === "artist") {
        return (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15C6.5 12.5 8.5 16.8 11.5 14.3C13.7 12.5 15.5 9.5 20 10.8" />
                <path d="M5 9c1.5-.8 3.2-.6 4.5.4" className="opacity-60" />
                <circle cx="17.8" cy="7.2" r="1.4" fill="currentColor" stroke="none" className="opacity-85" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16C5.8 19.3 7.2 10.7 9.6 14.5C11.2 17 12.4 8.3 15 11.4C16.3 13 17.5 9.5 20 10.8" />
            <path d="M4.5 8.8C6.5 6.6 7.2 10.5 9.4 8.9C10.9 7.8 12.1 5.3 14.2 6.8C16.2 8.2 17.8 5.8 19.8 7.1" className="opacity-75" />
            <path d="M6.2 5.4l1.4 1.4M18.3 4.8l-.9 1.6" className="opacity-70" />
        </svg>
    );
}

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
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [inspectorRevision, setInspectorRevision] = useState(0);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
    const stateRef = useRef<CanvasState | null>(null);
    const [canvasState, setCanvasState] = useState<CanvasState | null>(null);
    const [resolvedRoomId, setResolvedRoomId] = useState<number | null>(null);
    const [hoveredPersonaId, setHoveredPersonaId] = useState<string | null>(null);
    const [defaultRoughness, setDefaultRoughness] = useState<number>(DRAWING_PERSONAS[1]?.roughness ?? 1);
    const defaultRoughnessRef = useRef<number>(DRAWING_PERSONAS[1]?.roughness ?? 1);
    const {theme} = useTheme();
    const isDark = theme === "dark";

    useEffect(() => {
        toolRef.current = activeTool;
    }, [activeTool]);

    useEffect(() => {
        controlsRef.current?.rerender();
    }, [theme]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const raw = window.localStorage.getItem(DEFAULT_ROUGHNESS_STORAGE_KEY);
        if (raw === null) return;

        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;

        const next = Math.max(0, Math.min(5, parsed));
        setDefaultRoughness(next);
        defaultRoughnessRef.current = next;
    }, []);

    useEffect(() => {
        defaultRoughnessRef.current = defaultRoughness;

        if (typeof window !== "undefined") {
            window.localStorage.setItem(DEFAULT_ROUGHNESS_STORAGE_KEY, String(defaultRoughness));
        }
    }, [defaultRoughness]);

    useEffect(() => {
        const preventBrowserZoom = (event: WheelEvent) => {
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
            }
        };

        const preventGestureZoom = (event: Event) => {
            event.preventDefault();
        };

        window.addEventListener("wheel", preventBrowserZoom, {passive: false, capture: true});
        window.addEventListener("gesturestart", preventGestureZoom as EventListener, {passive: false, capture: true});
        window.addEventListener("gesturechange", preventGestureZoom as EventListener, {passive: false, capture: true});

        return () => {
            window.removeEventListener("wheel", preventBrowserZoom, true);
            window.removeEventListener("gesturestart", preventGestureZoom as EventListener, true);
            window.removeEventListener("gesturechange", preventGestureZoom as EventListener, true);
        };
    }, []);

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

        const pixelRatio = window.devicePixelRatio || 1;

        // set size
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        canvas.width = Math.round(window.innerWidth * pixelRatio);
        canvas.height = Math.round(window.innerHeight * pixelRatio);

        const initialViewport = loadStoredViewport(roomId);

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
            setInspectorRevision((current) => current + 1);
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
                getDefaultShapeStyle: () => ({
                    roughness: defaultRoughnessRef.current,
                }),
                initialViewport: initialViewport ?? undefined,
                onToolChange: (tool) => {
                    toolRef.current = tool;
                    setActiveTool(tool);
                },
                onSelectionChange: (selectedIds) => {
                    setSelectedCount(selectedIds.length);
                    setSelectedIds(selectedIds);
                },
                onViewportChange: (viewport) => {
                    saveStoredViewport(roomId, viewport);
                },
            });
        };

        void initializeCanvas();

        return () => {
            isUnmounted = true;

            controlsRef.current?.destroy();
            controlsRef.current = null;

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

    const selectedShapes = (() => {
        if (!canvasState || selectedIds.length === 0) return [];

        // Depend on inspectorRevision via render so remote/local mutations refresh inspector values.
        void inspectorRevision;
        const selectedSet = new Set(selectedIds);
        return canvasState.getShapes().filter((shape) => selectedSet.has(shape.id));
    })();

    const primarySelectedShape = selectedShapes[selectedShapes.length - 1] ?? null;

    const applyToSelectedShapes = (updates: Partial<Shape>) => {
        if (!canvasState || selectedIds.length === 0) return;

        const selectedSet = new Set(selectedIds);
        const nextShapes = canvasState.getShapes().map((shape) => {
            if (!selectedSet.has(shape.id)) return shape;
            return {
                ...shape,
                ...updates,
            } as Shape;
        });

        canvasState.setShapes(nextShapes);
        controlsRef.current?.rerender();
    };

    const strokeValue = primarySelectedShape?.stroke ?? "#f8fafc";
    const fillValue = primarySelectedShape?.fill ?? "#60a5fa";
    const strokeStyleValue = primarySelectedShape?.strokeStyle ?? "solid";
    const fillStyleValue = primarySelectedShape?.fillStyle ?? "solid";
    const strokeWidthValue = primarySelectedShape?.strokeWidth ?? 2;
    const roughnessValue = primarySelectedShape?.roughness ?? defaultRoughness;
    const opacityValue = primarySelectedShape?.opacity ?? 100;
    const showReplay = primarySelectedShape?.type === "freehand";
    const activePersona = DRAWING_PERSONAS.find((persona) => Math.abs(persona.roughness - roughnessValue) < 0.25) ?? null;
    const hoveredPersona = DRAWING_PERSONAS.find((persona) => persona.id === hoveredPersonaId) ?? null;

    const handleReplaySelected = () => {
        if (!primarySelectedShape) return;
        controlsRef.current?.replayShape(primarySelectedShape.id);
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

            {selectedCount > 0 && (
                <aside
                    className={`absolute left-4 top-20 z-20 w-72 rounded-2xl p-4 backdrop-blur ${
                        isDark
                            ? "border border-white/10 bg-[#191919]/95 text-white shadow-[0_16px_30px_rgba(0,0,0,0.45)]"
                            : "border border-slate-300/70 bg-white/95 text-slate-900 shadow-[0_16px_28px_rgba(15,23,42,0.14)]"
                    }`}
                >
                    <h3 className="mb-3 text-sm font-semibold">Style</h3>

                    <div className="mb-3">
                        <label className="text-xs font-medium opacity-80">Stroke</label>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                            {STYLE_SWATCHES.map((color) => {
                                const isSelected = strokeValue.toLowerCase() === color;
                                const hasVisibleBorder = color === "#ffffff";
                                return (
                                    <button
                                        key={`stroke-${color}`}
                                        type="button"
                                        onClick={() => applyToSelectedShapes({stroke: color})}
                                        className={`h-6 w-6 rounded border ${
                                            hasVisibleBorder
                                                ? isDark
                                                    ? "border-white/30"
                                                    : "border-slate-400"
                                                : "border-transparent"
                                        } ${isSelected ? "ring-2 ring-indigo-400" : ""}`}
                                        style={{backgroundColor: color}}
                                        title={`Stroke ${color}`}
                                    />
                                );
                            })}
                            <label
                                className={`relative h-6 w-6 cursor-pointer overflow-hidden rounded border ${
                                    isDark ? "border-white/25" : "border-slate-400"
                                }`}
                                title="Custom stroke color"
                            >
                                <span
                                    className="absolute inset-0"
                                    style={{
                                        background:
                                            "conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #0a84ff, #5e5ce6, #bf5af2, #ff2d55, #ff3b30)",
                                    }}
                                />
                                <input
                                    type="color"
                                    value={strokeValue}
                                    onChange={(e) => applyToSelectedShapes({stroke: e.target.value})}
                                    className="absolute inset-0 cursor-pointer opacity-0"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="text-xs font-medium opacity-80">Fill</label>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                            {STYLE_SWATCHES.map((color) => {
                                const isSelected = fillValue.toLowerCase() === color;
                                const hasVisibleBorder = color === "#ffffff";
                                return (
                                    <button
                                        key={`fill-${color}`}
                                        type="button"
                                        onClick={() => applyToSelectedShapes({fill: color})}
                                        className={`h-6 w-6 rounded border ${
                                            hasVisibleBorder
                                                ? isDark
                                                    ? "border-white/30"
                                                    : "border-slate-400"
                                                : "border-transparent"
                                        } ${isSelected ? "ring-2 ring-indigo-400" : ""}`}
                                        style={{backgroundColor: color}}
                                        title={`Fill ${color}`}
                                    />
                                );
                            })}
                            <label
                                className={`relative h-6 w-6 cursor-pointer overflow-hidden rounded border ${
                                    isDark ? "border-white/25" : "border-slate-400"
                                }`}
                                title="Custom fill color"
                            >
                                <span
                                    className="absolute inset-0"
                                    style={{
                                        background:
                                            "conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #0a84ff, #5e5ce6, #bf5af2, #ff2d55, #ff3b30)",
                                    }}
                                />
                                <input
                                    type="color"
                                    value={fillValue}
                                    onChange={(e) => applyToSelectedShapes({fill: e.target.value})}
                                    className="absolute inset-0 cursor-pointer opacity-0"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium opacity-80">Stroke Style</label>
                        <div className="flex items-center gap-2">
                            {STROKE_STYLE_OPTIONS.map((option) => (
                                <StrokeStyleTile
                                    key={option.value}
                                    value={option.value}
                                    selected={strokeStyleValue === option.value}
                                    onClick={() => applyToSelectedShapes({strokeStyle: option.value})}
                                    isDark={isDark}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium opacity-80">Fill Style</label>
                        <div className="flex items-center gap-2">
                            {FILL_STYLE_OPTIONS.map((option) => (
                                <FillStyleTile
                                    key={option.value}
                                    value={option.value}
                                    selected={fillStyleValue === option.value}
                                    onClick={() => applyToSelectedShapes({fillStyle: option.value})}
                                    isDark={isDark}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium opacity-80">Stroke Width: {strokeWidthValue}px</label>
                        <input
                            type="range"
                            min={1}
                            max={12}
                            value={strokeWidthValue}
                            onChange={(e) => applyToSelectedShapes({strokeWidth: Number(e.target.value)})}
                            className="w-full"
                        />
                    </div>

                    <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium opacity-80">Drawing Persona</label>
                        <div className="grid grid-cols-3 gap-2">
                            {DRAWING_PERSONAS.map((persona) => {
                                const isActive = activePersona?.id === persona.id;

                                return (
                                    <button
                                        key={persona.id}
                                        type="button"
                                        onClick={() => {
                                            setDefaultRoughness(persona.roughness);
                                            if (selectedCount > 0) {
                                                applyToSelectedShapes({roughness: persona.roughness});
                                            }
                                        }}
                                        onMouseEnter={() => setHoveredPersonaId(persona.id)}
                                        onMouseLeave={() => setHoveredPersonaId((current) => (current === persona.id ? null : current))}
                                        title={persona.label}
                                        className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                                            isActive
                                                ? isDark
                                                    ? "border-blue-300/70 bg-blue-500/20 text-blue-100"
                                                    : "border-blue-400 bg-blue-100 text-blue-900"
                                                : isDark
                                                    ? "border-white/15 bg-[#232323] text-white/75 hover:border-blue-300/45 hover:text-white"
                                                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:text-slate-900"
                                        }`}
                                    >
                                        <span
                                            className={`mb-1 inline-flex h-4 w-full items-center justify-center ${
                                                isActive
                                                    ? isDark
                                                        ? "text-blue-100"
                                                        : "text-blue-900"
                                                    : isDark
                                                        ? "text-slate-200"
                                                        : "text-slate-600"
                                            }`}
                                        >
                                            <PersonaButtonGlyph personaId={persona.id} />
                                        </span>
                                        {persona.label}
                                    </button>
                                );
                            })}
                        </div>

                        {hoveredPersona && (
                            <div
                                className={`mt-2 rounded-lg border p-2 ${
                                    isDark ? "border-blue-300/30 bg-blue-500/10" : "border-blue-200 bg-blue-50/80"
                                }`}
                            >
                                <p className={`text-xs font-semibold ${isDark ? "text-blue-200" : "text-blue-800"}`}>
                                    {hoveredPersona.label}
                                </p>
                                <p className={`mb-2 text-[11px] ${isDark ? "text-blue-100/80" : "text-blue-700/85"}`}>
                                    {hoveredPersona.summary}
                                </p>
                                <div className="grid grid-cols-3 gap-1">
                                    {hoveredPersona.examples.map((example) => (
                                        <div
                                            key={`${hoveredPersona.id}-${example}`}
                                            className={`group relative rounded-md border px-1 py-1 ${
                                                isDark
                                                    ? "border-blue-200/30 bg-[#1f2a44]"
                                                    : "border-blue-200 bg-white"
                                            }`}
                                        >
                                            <PersonaExampleGlyph example={example} isDark={isDark} />
                                            <span
                                                className={`pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium opacity-0 shadow transition-opacity group-hover:opacity-100 ${
                                                    isDark
                                                        ? "bg-slate-900/95 text-blue-100"
                                                        : "bg-slate-800 text-blue-50"
                                                }`}
                                            >
                                                {example}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium opacity-80">Opacity: {opacityValue}%</label>
                        <input
                            type="range"
                            min={10}
                            max={100}
                            value={opacityValue}
                            onChange={(e) => applyToSelectedShapes({opacity: Number(e.target.value)})}
                            className="w-full"
                        />
                    </div>

                    {showReplay && (
                        <button
                            type="button"
                            onClick={handleReplaySelected}
                            className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                isDark
                                    ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                                    : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                        >
                            Replay Stroke
                        </button>
                    )}
                </aside>
            )}
            <div
                className={`absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-3xl p-3 backdrop-blur ${
                    isDark
                        ? "border border-white/10 bg-[#191919]/95 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
                        : "border border-slate-300/70 bg-white/90 shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
                }`}
            >
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                    {TOOLS.map((tool) => {
                        const isActive = activeTool === tool.id;

                        return (
                            <button
                                key={tool.id}
                                type="button"
                                onClick={() => setActiveTool(tool.id)}
                                title={`${tool.label} (${tool.shortcut})`}
                                className={`group flex shrink-0 min-w-18 flex-col items-center rounded-2xl border px-3 py-2 transition ${
                                    isActive
                                        ? isDark
                                            ? "border-[#8d8ac5] bg-[#8d8ac5]/20 text-white"
                                            : "border-blue-300 bg-blue-50 text-slate-900"
                                        : isDark
                                            ? "border-transparent bg-[#232323] text-white/85 hover:border-white/20 hover:text-white"
                                            : "border-transparent bg-slate-100 text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                }`}
                            >
                                <span className="flex h-5 w-5 items-center justify-center">{tool.icon}</span>
                                <span
                                    className={`mt-1 text-[11px] font-medium ${
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
                    <div className={`mx-1 hidden h-10 w-px flex-none sm:block ${isDark ? "bg-white/10" : "bg-slate-300"}`} />
                    <button
                        type="button"
                        onClick={handleDeleteSelected}
                        disabled={selectedCount === 0}
                        title="Delete selected shapes (Delete/Backspace)"
                        className={`group flex shrink-0 min-w-18 flex-col items-center rounded-2xl border px-3 py-2 transition ${
                            selectedCount > 0
                                ? isDark
                                    ? "border-red-300/30 bg-red-500/15 text-white hover:border-red-200/50 hover:bg-red-500/20"
                                    : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                : isDark
                                    ? "cursor-not-allowed border-transparent bg-[#232323] text-white/40"
                                    : "cursor-not-allowed border-transparent bg-slate-100 text-slate-400"
                        }`}
                    >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                        </svg>
                        <span
                            className={`mt-1 text-[11px] font-medium ${
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
                    className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
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
                        className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            isDark
                                ? "border-blue-300/30 bg-blue-500/15 text-blue-300 hover:border-blue-200/50 hover:bg-blue-500/20"
                                : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}
                    >
                        <svg
                            className="h-5 w-5"
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

            <canvas ref={canvasRef} className="block h-full w-full touch-none" />
        </div>
    );
}
