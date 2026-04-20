"use client";

import {ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {useParams} from "next/navigation";
import {AxiosError} from "axios";
import {jsPDF} from "jspdf";
import {attachEvents} from "@repo/canvas-engine";
import {CanvasState} from "@repo/canvas-engine";
import type {Shape, Tool} from "@repo/canvas-engine";
import {HTTP_BACKEND} from "../../../config";
import {apiClient} from "../../lib/apiClient";
import {ensureAuthenticated, logoutUser} from "../../lib/auth";
import {useTheme} from "../../components/ThemeToggle";
import {useCanvasSync} from "../../../hooks/useCanvasSync";
import {RemotePresenceLayer} from "../../components/RemotePresenceLayer";

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

type DebugOverlaySnapshot = {
    version: number;
    shapeCount: number;
    shapeIds: string[];
    capturedAt: string;
};

type DebugPanelMode = "compact" | "verbose";

type Toast = {
    id: number;
    tone: "success" | "error" | "info";
    message: string;
};

type ExportFormat = "png" | "svg" | "pdf" | "json";

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

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function escapeXml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function getShapeBounds(shape: Shape) {
    if (shape.type === "rect" || shape.type === "rhombus" || shape.type === "text") {
        return {
            minX: shape.x,
            minY: shape.y,
            maxX: shape.x + shape.width,
            maxY: shape.y + shape.height,
        };
    }

    if (shape.type === "circle") {
        return {
            minX: shape.centerX - shape.radiusX,
            minY: shape.centerY - shape.radiusY,
            maxX: shape.centerX + shape.radiusX,
            maxY: shape.centerY + shape.radiusY,
        };
    }

    if (shape.type === "line" || shape.type === "arrow") {
        return {
            minX: Math.min(shape.x1, shape.x2),
            minY: Math.min(shape.y1, shape.y2),
            maxX: Math.max(shape.x1, shape.x2),
            maxY: Math.max(shape.y1, shape.y2),
        };
    }

    if (shape.type === "freehand") {
        if (shape.points.length === 0) {
            return {minX: 0, minY: 0, maxX: 0, maxY: 0};
        }

        const xs = shape.points.map((point) => point.x);
        const ys = shape.points.map((point) => point.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    return {minX: 0, minY: 0, maxX: 0, maxY: 0};
}

function buildSvgMarkup(shapes: Shape[]) {
    if (shapes.length === 0) {
        return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"/>`;
    }

    const bounds = shapes.map(getShapeBounds);
    const minX = Math.min(...bounds.map((box) => box.minX));
    const minY = Math.min(...bounds.map((box) => box.minY));
    const maxX = Math.max(...bounds.map((box) => box.maxX));
    const maxY = Math.max(...bounds.map((box) => box.maxY));
    const padding = 32;
    const width = Math.max(1, maxX - minX + padding * 2);
    const height = Math.max(1, maxY - minY + padding * 2);
    const viewBox = `${minX - padding} ${minY - padding} ${width} ${height}`;

    const shapeElements = shapes
        .map((shape) => {
            const stroke = shape.stroke ?? "#1e1e1e";
            const strokeWidth = shape.strokeWidth ?? 2;
            const opacity = Math.max(0, Math.min(1, (shape.opacity ?? 100) / 100));
            const dashArray =
                shape.strokeStyle === "dashed"
                    ? `${strokeWidth * 4} ${strokeWidth * 3}`
                    : shape.strokeStyle === "dotted"
                        ? `${strokeWidth} ${strokeWidth * 2}`
                        : "none";

            let fill = shape.fill ?? "none";
            if (shape.fillStyle && shape.fillStyle !== "solid") {
                fill = "none";
            }

            if (shape.type === "rect") {
                return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" opacity="${opacity}" />`;
            }

            if (shape.type === "circle") {
                return `<ellipse cx="${shape.centerX}" cy="${shape.centerY}" rx="${shape.radiusX}" ry="${shape.radiusY}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" opacity="${opacity}" />`;
            }

            if (shape.type === "rhombus") {
                const points = [
                    `${shape.x + shape.width / 2},${shape.y}`,
                    `${shape.x + shape.width},${shape.y + shape.height / 2}`,
                    `${shape.x + shape.width / 2},${shape.y + shape.height}`,
                    `${shape.x},${shape.y + shape.height / 2}`,
                ].join(" ");
                return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" opacity="${opacity}" />`;
            }

            if (shape.type === "line") {
                return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" stroke-linecap="round" opacity="${opacity}" />`;
            }

            if (shape.type === "arrow") {
                return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" stroke-linecap="round" marker-end="url(#arrow-head)" opacity="${opacity}" />`;
            }

            if (shape.type === "text") {
                const safeText = escapeXml(shape.text || "");
                return `<text x="${shape.x}" y="${shape.y + shape.fontSize}" fill="${stroke}" font-size="${shape.fontSize}" font-family="Arial, sans-serif" opacity="${opacity}">${safeText}</text>`;
            }

            if (shape.type === "freehand") {
                if (shape.points.length === 0) return "";
                const points = shape.points.map((point) => `${point.x},${point.y}`).join(" ");
                return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`;
            }

            return "";
        })
        .filter(Boolean)
        .join("\n  ");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${Math.ceil(width)}" height="${Math.ceil(height)}">\n  <defs>\n    <marker id="arrow-head" orient="auto" markerWidth="10" markerHeight="7" refX="9" refY="3.5">\n      <polygon points="0 0, 10 3.5, 0 7" fill="#1e1e1e" />\n    </marker>\n  </defs>\n  ${shapeElements}\n</svg>`;
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
    const isHydratingRef = useRef(true);
    const resolvedRoomIdRef = useRef<number | null>(null);

    const toolRef = useRef<Tool>("select");
    const [activeTool, setActiveTool] = useState<Tool>("select");
    const [selectedCount, setSelectedCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [inspectorRevision, setInspectorRevision] = useState(0);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const stateRef = useRef<CanvasState | null>(null);
    const [canvasState, setCanvasState] = useState<CanvasState | null>(null);
    const [resolvedRoomId, setResolvedRoomId] = useState<number | null>(null);
    const [hoveredPersonaId, setHoveredPersonaId] = useState<string | null>(null);
    const [defaultRoughness, setDefaultRoughness] = useState<number>(DRAWING_PERSONAS[1]?.roughness ?? 1);
    const defaultRoughnessRef = useRef<number>(DRAWING_PERSONAS[1]?.roughness ?? 1);
    const [viewport, setViewport] = useState<StoredViewport | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isReloadingCanvas, setIsReloadingCanvas] = useState(false);
    const [isSavingCanvas, setIsSavingCanvas] = useState(false);
    const [showRoomInfo, setShowRoomInfo] = useState(false);
    const [isGridVisible, setIsGridVisible] = useState(true);
    const [showDebugOverlay, setShowDebugOverlay] = useState(false);
    const [debugPanelMode, setDebugPanelMode] = useState<DebugPanelMode>("compact");
    const [debugOverlaySnapshot, setDebugOverlaySnapshot] = useState<DebugOverlaySnapshot | null>(null);
    const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>("png");
    const [isSnapEnabled, setIsSnapEnabled] = useState(true);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [isClearCanvasModalOpen, setIsClearCanvasModalOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement | null>(null);
    const menuPanelRef = useRef<HTMLDivElement | null>(null);
    const menuFocusIndexRef = useRef(0);
    const toastIdRef = useRef(0);
    const skipNextViewportPersistRef = useRef(false);
    const {theme, toggleTheme} = useTheme();
    const isDark = theme === "dark";

    useEffect(() => {
        toolRef.current = activeTool;
    }, [activeTool]);

    const getMenuItems = useCallback(() => {
        if (!menuPanelRef.current) return [];
        return Array.from(menuPanelRef.current.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not([disabled])"));
    }, []);

    const syncMenuRovingFocus = useCallback((nextIndex: number, focus = false) => {
        const menuItems = getMenuItems();
        if (menuItems.length === 0) return;

        const safeIndex = ((nextIndex % menuItems.length) + menuItems.length) % menuItems.length;
        menuFocusIndexRef.current = safeIndex;

        menuItems.forEach((item, index) => {
            item.tabIndex = index === safeIndex ? 0 : -1;
        });

        if (focus) {
            menuItems[safeIndex]?.focus();
        }
    }, [getMenuItems]);

    const pushToast = useCallback((tone: Toast["tone"], message: string) => {
        const id = toastIdRef.current + 1;
        toastIdRef.current = id;
        setToasts((current) => [...current, {id, tone, message}]);

        window.setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 3200);
    }, []);

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
        if (!isMenuOpen) return;

        const raf = window.requestAnimationFrame(() => {
            syncMenuRovingFocus(0, true);
        });

        return () => {
            window.cancelAnimationFrame(raf);
        };
    }, [isMenuOpen, syncMenuRovingFocus]);

    useEffect(() => {
        if (!isMenuOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuPanelRef.current?.contains(target) || menuButtonRef.current?.contains(target)) {
                return;
            }
            setIsMenuOpen(false);
            setShowRoomInfo(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setIsMenuOpen(false);
            setShowRoomInfo(false);
            menuButtonRef.current?.focus();
        };

        window.addEventListener("mousedown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("mousedown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMenuOpen]);

    useEffect(() => {
        if (!isMenuOpen) return;

        const root = document.documentElement;
        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyTouchAction = document.body.style.touchAction;
        const previousRootOverflow = root.style.overflow;
        const previousRootOverscrollBehavior = root.style.overscrollBehavior;

        root.style.overflow = "hidden";
        root.style.overscrollBehavior = "none";
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";

        return () => {
            root.style.overflow = previousRootOverflow;
            root.style.overscrollBehavior = previousRootOverscrollBehavior;
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.touchAction = previousBodyTouchAction;
        };
    }, [isMenuOpen]);

    useEffect(() => {
        if (!roomId) return;

        isHydratingRef.current = true;
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
        setViewport(initialViewport ?? {x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 1});

        const state = new CanvasState();
        stateRef.current = state;
        setCanvasState(state);

        const getShapesById = async (id: number) => {
            const response = await apiClient.get(`${HTTP_BACKEND}/room/${id}/shapes`);

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
                const roomBySlug = await apiClient.get(`${HTTP_BACKEND}/room/room/slug/${encodeURIComponent(effectiveSlug)}`);

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
                    const createRoomResponse = await apiClient.post(
                        `${HTTP_BACKEND}/room`,
                        {slug: effectiveSlug}
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

                    const roomBySlug = await apiClient.get(`${HTTP_BACKEND}/room/room/slug/${encodeURIComponent(effectiveSlug)}`);

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

        // Subscribe the page to CanvasState updates for UI refresh only.
        // Canvas persistence is handled by websocket sync to avoid races.
        const unsubscribe = state.subscribe(() => {
            // Ensure remote websocket updates repaint immediately without requiring focus.
            controlsRef.current?.rerender();
            setInspectorRevision((current) => current + 1);
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
                    return;
                }

                console.error("Failed to load shapes", error);
            } finally {
                isHydratingRef.current = false;
            }
        };

        const initializeCanvas = async () => {
            const isAuthenticated = await ensureAuthenticated(`/canvas/${roomId}`);
            if (!isAuthenticated || isUnmounted) {
                isHydratingRef.current = false;
                return;
            }

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
                    setViewport(viewport);
                    if (skipNextViewportPersistRef.current) {
                        skipNextViewportPersistRef.current = false;
                        return;
                    }
                    saveStoredViewport(roomId, viewport);
                },
            });

            setIsGridVisible(controlsRef.current.isGridVisible());
            setIsSnapEnabled(controlsRef.current.isSnapEnabled());
        };

        void initializeCanvas();

        return () => {
            isUnmounted = true;

            controlsRef.current?.destroy();
            controlsRef.current = null;

            // Stop listening to state updates when this page unmounts.
            // Without this, a stale callback could keep firing saves.
            unsubscribe();
        };
    }, [roomId]);

    // Initialize WebSocket sync when state and room are ready
    const syncResult = useCanvasSync({
        roomId: resolvedRoomId ?? 0,
        state: canvasState,
        enabled: canvasState !== null && resolvedRoomId !== null,
        localSelectionIds: selectedIds,
        localTool: activeTool,
    });

    useEffect(() => {
        if (syncResult.lastSyncError) {
            setSyncStatus("error");
            return;
        }

        setSyncStatus(syncResult.isConnected ? "connected" : "disconnected");
    }, [syncResult.isConnected, syncResult.lastSyncError]);

    useEffect(() => {
        if (!showDebugOverlay) return;

        const captureSnapshot = () => {
            const shapes = canvasState?.getShapes() ?? [];
            setDebugOverlaySnapshot({
                version: syncResult.syncVersion,
                shapeCount: shapes.length,
                shapeIds: shapes.slice(0, 25).map((shape) => shape.id),
                capturedAt: new Date().toLocaleTimeString(),
            });
        };

        captureSnapshot();
        const timer = window.setInterval(captureSnapshot, 220);

        return () => {
            window.clearInterval(timer);
        };
    }, [showDebugOverlay, canvasState, syncResult.syncVersion]);

    // Fetch and display invite link
    useEffect(() => {
        if (!roomId) return;

        setInviteLink(`${window.location.origin}/canvas/${roomId}`);
    }, [roomId]);

    const handleDeleteSelected = () => {
        controlsRef.current?.deleteSelection();
    };

    const handleLogout = async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);
        try {
            await logoutUser();
        } finally {
            window.location.href = "/signin";
        }
    };

    const handleOpenProfile = () => {
        window.location.href = "/profile";
    };

    const selectedShapes = (() => {
        if (!canvasState || selectedIds.length === 0) return [];

        // Depend on inspectorRevision via render so remote/local mutations refresh inspector values.
        void inspectorRevision;
        const selectedSet = new Set(selectedIds);
        return canvasState.getShapes().filter((shape) => selectedSet.has(shape.id));
    })();

    const primarySelectedShape = selectedShapes[selectedShapes.length - 1] ?? null;
    const isTextShapeSelection = primarySelectedShape?.type === "text";

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

    const applyToSelectedTextShapes = (updates: Partial<Extract<Shape, {type: "text"}>>) => {
        if (!canvasState || selectedIds.length === 0) return;

        const selectedSet = new Set(selectedIds);
        const nextShapes = canvasState.getShapes().map((shape) => {
            if (!selectedSet.has(shape.id) || shape.type !== "text") {
                return shape;
            }

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
    const textFontSizeValue = primarySelectedShape?.type === "text" ? primarySelectedShape.fontSize : 24;
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
        if (!inviteLink) {
            pushToast("error", "Invite link is unavailable right now.");
            return;
        }

        navigator.clipboard
            .writeText(inviteLink)
            .then(() => {
                pushToast("success", "Invite link copied to clipboard.");
            })
            .catch(() => {
                pushToast("error", "Failed to copy invite link.");
            });
    };

    const handleClearCanvas = () => {
        if (!canvasState) return;
        setIsClearCanvasModalOpen(true);
    };

    const confirmClearCanvas = () => {
        if (!canvasState) return;

        canvasState.setShapes([]);
        controlsRef.current?.rerender();
        pushToast("info", "Canvas cleared.");
    };

    const handleResetView = () => {
        skipNextViewportPersistRef.current = true;
        controlsRef.current?.resetViewport();
    };

    const handleReloadCanvas = async () => {
        if (!canvasState || resolvedRoomId === null || isReloadingCanvas) return;

        setIsReloadingCanvas(true);
        try {
            const response = await apiClient.get(`${HTTP_BACKEND}/room/${resolvedRoomId}/shapes`);
            const persistedShapes = response.data?.data;
            const shapes = Array.isArray(persistedShapes) ? (persistedShapes as Shape[]) : [];
            canvasState.hydrateShapes(shapes);
            controlsRef.current?.rerender();
            pushToast("success", "Canvas reloaded from server.");
        } catch (error) {
            console.error("Failed to reload canvas", error);
            pushToast("error", "Unable to reload canvas right now.");
        } finally {
            setIsReloadingCanvas(false);
        }
    };

    const handleManualSaveCanvas = async () => {
        if (!canvasState || resolvedRoomId === null || isSavingCanvas) return;

        setIsSavingCanvas(true);
        try {
            await apiClient.put(`${HTTP_BACKEND}/room/${resolvedRoomId}/shapes`, {
                shapes: canvasState.getShapes(),
            });
            pushToast("success", "Canvas saved.");
        } catch (error) {
            console.error("Failed to save canvas", error);
            pushToast("error", "Unable to save canvas right now.");
        } finally {
            setIsSavingCanvas(false);
        }
    };

    const handleToggleGridVisibility = () => {
        const next = !isGridVisible;
        controlsRef.current?.setGridVisible(next);
        setIsGridVisible(next);
    };

    const handleToggleSnap = () => {
        const next = !isSnapEnabled;
        controlsRef.current?.setSnapEnabled(next);
        setIsSnapEnabled(next);
    };

    const handleToggleDebugOverlay = () => {
        setShowDebugOverlay((current) => !current);
    };

    const handleToggleDebugPanelMode = () => {
        setDebugPanelMode((current) => (current === "compact" ? "verbose" : "compact"));
    };

    const handleExportJson = () => {
        if (!canvasState) return;

        const payload = {
            roomSlug: roomId ?? "",
            roomId: resolvedRoomId,
            version: syncResult.syncVersion,
            exportedAt: new Date().toISOString(),
            shapes: canvasState.getShapes(),
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
        downloadBlob(blob, `${roomId ?? "canvas"}.json`);
    };

    const handleExportPng = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.toBlob((blob) => {
            if (!blob) {
                pushToast("error", "Unable to export PNG.");
                return;
            }

            downloadBlob(blob, `${roomId ?? "canvas"}.png`);
        }, "image/png");
    };

    const handleExportSvg = () => {
        if (!canvasState) return;

        const markup = buildSvgMarkup(canvasState.getShapes());
        const blob = new Blob([markup], {type: "image/svg+xml;charset=utf-8"});
        downloadBlob(blob, `${roomId ?? "canvas"}.svg`);
    };

    const handleExportPdf = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const width = Math.max(canvas.clientWidth, 1);
            const height = Math.max(canvas.clientHeight, 1);
            const orientation = width >= height ? "landscape" : "portrait";
            const pdf = new jsPDF({
                orientation,
                unit: "px",
                format: [width, height],
            });

            const dataUrl = canvas.toDataURL("image/png", 1);
            pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
            pdf.save(`${roomId ?? "canvas"}.pdf`);
        } catch (error) {
            console.error("Failed to export PDF", error);
            pushToast("error", "Unable to export PDF.");
        }
    };

    const handleExportSelected = () => {
        if (selectedExportFormat === "png") {
            handleExportPng();
            return;
        }

        if (selectedExportFormat === "svg") {
            handleExportSvg();
            return;
        }

        if (selectedExportFormat === "pdf") {
            handleExportPdf();
            return;
        }

        handleExportJson();
    };

    const handleSwitchAccount = async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);
        try {
            await logoutUser();
        } finally {
            window.location.href = "/signin";
        }
    };

    const remotePresenceState = syncResult.presenceState;
    const connectedUsersCount = Number.isFinite(syncResult.connectedUsersCount)
        ? syncResult.connectedUsersCount
        : 0;
    const participantNames = remotePresenceState.presences
        .map((presence) => presence.userName)
        .filter((name, index, all) => all.indexOf(name) === index);

    return (
        <div className={`relative h-screen w-screen ${isDark ? "bg-[#121212]" : "bg-[#e2e8f0]"}`}>
            <div className="pointer-events-none absolute right-4 top-4 z-30">
                <div className="pointer-events-auto relative">
                    <button
                        ref={menuButtonRef}
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        aria-controls="canvas-overflow-menu"
                        onClick={() => {
                            setIsMenuOpen((current) => {
                                const next = !current;
                                if (!next) {
                                    setShowRoomInfo(false);
                                }
                                return next;
                            });
                        }}
                        className={`grid h-11 w-11 place-items-center rounded-full border text-xl transition ${
                            isDark
                                ? "border-white/15 bg-[#191919]/95 text-white hover:bg-[#252525]"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                        title="More actions"
                        aria-label="More actions"
                    >
                        <span aria-hidden="true">⋯</span>
                    </button>

                    {isMenuOpen && (
                        <div
                            ref={menuPanelRef}
                            id="canvas-overflow-menu"
                            role="menu"
                            aria-label="Canvas actions"
                            onFocusCapture={(event) => {
                                const menuItems = getMenuItems();
                                const focusTarget = event.target as EventTarget | null;
                                const focusedIndex = menuItems.findIndex((item) => item === focusTarget);
                                if (focusedIndex >= 0) {
                                    syncMenuRovingFocus(focusedIndex, false);
                                }
                            }}
                            onKeyDown={(event) => {
                                const menuItems = getMenuItems();
                                if (menuItems.length === 0) return;

                                if (event.key === "ArrowDown") {
                                    event.preventDefault();
                                    syncMenuRovingFocus(menuFocusIndexRef.current + 1, true);
                                    return;
                                }

                                if (event.key === "ArrowUp") {
                                    event.preventDefault();
                                    syncMenuRovingFocus(menuFocusIndexRef.current - 1, true);
                                    return;
                                }

                                if (event.key === "Home") {
                                    event.preventDefault();
                                    syncMenuRovingFocus(0, true);
                                    return;
                                }

                                if (event.key === "End") {
                                    event.preventDefault();
                                    syncMenuRovingFocus(menuItems.length - 1, true);
                                    return;
                                }

                                if (event.key === "Enter" || event.key === " ") {
                                    const activeElement = document.activeElement as HTMLElement | null;
                                    const activeIndex = menuItems.findIndex((item) => item === activeElement);
                                    const targetIndex = activeIndex >= 0 ? activeIndex : menuFocusIndexRef.current;
                                    if (targetIndex < 0) return;

                                    event.preventDefault();
                                    menuItems[targetIndex]?.click();
                                }
                            }}
                            onWheel={(event) => {
                                event.stopPropagation();
                            }}
                            className={`absolute right-0 top-14 max-h-[calc(100vh-5.5rem)] w-80 overflow-y-auto overscroll-contain rounded-2xl border p-2 shadow-2xl ${
                                isDark
                                    ? "border-white/10 bg-[#191919]/97 text-white"
                                    : "border-slate-300/80 bg-white/98 text-slate-900"
                            }`}
                        >
                            <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">Profile & Account</div>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setShowRoomInfo(false);
                                    handleOpenProfile();
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                View profile
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setShowRoomInfo(false);
                                    void handleLogout();
                                }}
                                disabled={isLoggingOut}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "text-red-300 hover:bg-red-500/20" : "text-red-700 hover:bg-red-100"
                                } ${isLoggingOut ? "cursor-not-allowed opacity-70" : ""}`}
                            >
                                {isLoggingOut ? "Logging out..." : "Logout"}
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setShowRoomInfo(false);
                                    void handleSwitchAccount();
                                }}
                                disabled={isLoggingOut}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                <span>Switch account</span>
                            </button>

                            <div className={`my-2 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">Canvas Actions</div>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setShowRoomInfo(false);
                                    handleClearCanvas();
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                Clear canvas
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setShowRoomInfo(false);
                                    handleResetView();
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                Reset view
                            </button>

                            <div className={`my-2 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">Data & Persistence</div>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setShowRoomInfo(false);
                                    void handleReloadCanvas();
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                } ${isReloadingCanvas ? "cursor-not-allowed opacity-70" : ""}`}
                                disabled={isReloadingCanvas}
                            >
                                {isReloadingCanvas ? "Reloading canvas..." : "Reload canvas"}
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setShowRoomInfo(false);
                                    void handleManualSaveCanvas();
                                }}
                                disabled={isSavingCanvas}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                <span>{isSavingCanvas ? "Saving canvas..." : "Save canvas manually"}</span>
                                <span className="text-[11px] opacity-70">Force snapshot</span>
                            </button>

                            <div className={`my-2 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">Collaboration</div>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    handleCopyInvite();
                                    setIsMenuOpen(false);
                                    setShowRoomInfo(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                Copy invite link
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setShowRoomInfo((current) => !current);
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                <span>Show room info</span>
                                <span className="text-xs opacity-70">{showRoomInfo ? "Hide" : "Show"}</span>
                            </button>
                            {showRoomInfo && (
                                <div
                                    className={`mx-2 mt-1 rounded-lg border px-3 py-2 text-xs ${
                                        isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                                    }`}
                                >
                                    <div className="mb-1">Room slug: {roomId ?? "-"}</div>
                                    <div className="mb-1">Room id: {resolvedRoomId ?? "-"}</div>
                                    <div className="mb-1">Participants: {connectedUsersCount}</div>
                                    <div className="max-h-20 overflow-y-auto opacity-80">
                                        {participantNames.length > 0 ? participantNames.join(", ") : "No active participants"}
                                    </div>
                                </div>
                            )}

                            <div className={`my-2 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">Settings</div>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => toggleTheme()}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                <span>Toggle dark/light mode</span>
                                <span className="text-xs opacity-70">{isDark ? "Dark" : "Light"}</span>
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleToggleGridVisibility}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                <span>Toggle grid visibility</span>
                                <span className="text-xs opacity-70">{isGridVisible ? "On" : "Off"}</span>
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleToggleSnap}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                <span>Toggle snap</span>
                                <span className="text-[11px] opacity-70">{isSnapEnabled ? "On" : "Off"}</span>
                            </button>

                            <div className={`my-2 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">Debug / System</div>
                            <div
                                className={`mx-2 mb-1 rounded-lg px-3 py-2 text-xs ${
                                    isDark ? "bg-white/5 text-white/85" : "bg-slate-100 text-slate-700"
                                }`}
                            >
                                WS status: {syncStatus}
                                {syncResult.lastSyncError ? ` (${syncResult.lastSyncError})` : ""}
                            </div>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleToggleDebugOverlay}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                <span>Toggle debug overlay</span>
                                <span className="text-xs opacity-70">{showDebugOverlay ? "On" : "Off"}</span>
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleToggleDebugPanelMode}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                    isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                                }`}
                            >
                                <span>Debug panel mode</span>
                                <span className="text-xs opacity-70">{debugPanelMode === "compact" ? "Compact" : "Verbose"}</span>
                            </button>

                            <div className={`my-2 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">Export</div>
                            <div
                                className={`mx-2 rounded-xl border p-2 ${
                                    isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
                                }`}
                            >
                                <label className="mb-1 block px-1 text-[11px] font-medium opacity-70">Export format</label>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedExportFormat}
                                        onChange={(event) => setSelectedExportFormat(event.target.value as ExportFormat)}
                                        className={`w-full rounded-lg border px-2 py-2 text-sm outline-none ${
                                            isDark
                                                ? "border-white/15 bg-[#252525] text-white"
                                                : "border-slate-300 bg-white text-slate-800"
                                        }`}
                                    >
                                        <option value="png">PNG - image snapshot</option>
                                        <option value="svg">SVG - vector export</option>
                                        <option value="pdf">PDF - ready to share</option>
                                        <option value="json">JSON - raw scene data</option>
                                    </select>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            handleExportSelected();
                                            setIsMenuOpen(false);
                                            setShowRoomInfo(false);
                                        }}
                                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                            isDark
                                                ? "border-white/15 bg-[#252525] hover:bg-[#2f2f2f]"
                                                : "border-slate-300 bg-white hover:bg-slate-100"
                                        }`}
                                    >
                                        Export
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
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
                        <label className="text-xs font-medium opacity-80">{isTextShapeSelection ? "Text Color" : "Stroke"}</label>
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

                    {!isTextShapeSelection && (
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
                    )}

                    {!isTextShapeSelection && (
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
                    )}

                    {!isTextShapeSelection && (
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
                    )}

                    {!isTextShapeSelection && (
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
                    )}

                    {isTextShapeSelection && (
                        <div className="mb-3">
                            <label className="mb-1 block text-xs font-medium opacity-80">Font Size: {textFontSizeValue}px</label>
                            <input
                                type="range"
                                min={12}
                                max={96}
                                value={textFontSizeValue}
                                onChange={(e) => applyToSelectedTextShapes({fontSize: Number(e.target.value)})}
                                className="w-full"
                            />
                        </div>
                    )}

                    {!isTextShapeSelection && (
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
                    )}

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

                    {!isTextShapeSelection && showReplay && (
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

            {/* Sync Status */}
            <div className="absolute bottom-4 right-4 z-20">
                <div
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium backdrop-blur ${
                        syncStatus === "connected"
                            ? isDark
                                ? "bg-green-500/15 text-green-300"
                                : "bg-green-100 text-green-700"
                            : syncStatus === "error"
                                ? isDark
                                    ? "bg-red-500/15 text-red-300"
                                    : "bg-red-100 text-red-700"
                            : isDark
                                ? "bg-yellow-500/15 text-yellow-300"
                                : "bg-yellow-100 text-yellow-700"
                    }`}
                >
                    <span
                        className={`h-2 w-2 rounded-full ${
                            syncStatus === "connected"
                                ? "bg-green-500"
                                : syncStatus === "error"
                                    ? "bg-red-500"
                                    : "bg-yellow-500"
                        }`}
                    />
                    {connectedUsersCount} {connectedUsersCount === 1 ? "user connected" : "users connected"}
                </div>
            </div>

            <RemotePresenceLayer
                presenceState={remotePresenceState}
                currentUserId={syncResult.currentUserId}
                viewport={viewport}
                shapes={canvasState?.getShapes() ?? []}
                isDark={isDark}
            />

            {showDebugOverlay && (
                <div
                    onWheel={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    className={`pointer-events-auto absolute bottom-4 left-4 z-20 max-h-[min(60vh,28rem)] w-80 overflow-y-auto overscroll-contain rounded-2xl border px-3 py-2 text-xs backdrop-blur ${
                        isDark
                            ? "border-white/15 bg-[#171717]/92 text-white/90"
                            : "border-slate-300/80 bg-white/92 text-slate-700"
                    }`}
                >
                    <div className="mb-2 font-semibold">Debug Overlay ({debugPanelMode})</div>
                    <div className="mb-1">Room slug: {roomId ?? "-"}</div>
                    <div className="mb-1">Room id: {resolvedRoomId ?? "-"}</div>
                    <div className="mb-1">WS status: {syncStatus}</div>
                    <div className="mb-1">Sync version: {debugOverlaySnapshot?.version ?? syncResult.syncVersion}</div>
                    <div className="mb-1">Captured: {debugOverlaySnapshot?.capturedAt ?? "-"}</div>
                    <div className="mb-2">Shape count: {debugOverlaySnapshot?.shapeCount ?? (canvasState?.getShapes().length ?? 0)}</div>
                    {debugPanelMode === "verbose" && (
                        <>
                            <div className="mb-1">WS latency: {syncResult.websocketLatencyMs !== null ? `${syncResult.websocketLatencyMs}ms` : "-"}</div>
                            <div className="mb-2">In-flight snapshots: {syncResult.inFlightSnapshotCount}</div>
                        </>
                    )}
                    <div className="font-medium">Shape IDs</div>
                    <div className="opacity-80">
                        {(debugOverlaySnapshot?.shapeIds ?? []).join(", ") || "No shapes"}
                    </div>
                    {debugPanelMode === "verbose" && (
                        <>
                            <div className="mt-3 font-medium">Event timeline</div>
                            <div className="mt-1 space-y-1 opacity-85">
                                {syncResult.eventTimeline.length === 0 ? (
                                    <div>No events yet</div>
                                ) : (
                                    syncResult.eventTimeline
                                        .slice(-12)
                                        .map((entry) => (
                                            <div key={entry.id} className="rounded-md bg-black/10 px-2 py-1">
                                                <span className="mr-1 opacity-70">[{entry.at}]</span>
                                                <span className="mr-1 font-semibold">{entry.type}</span>
                                                <span>{entry.detail}</span>
                                            </div>
                                        ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="pointer-events-none absolute right-4 top-20 z-40 flex w-88 flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-lg ${
                            toast.tone === "success"
                                ? isDark
                                    ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100"
                                    : "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : toast.tone === "error"
                                    ? isDark
                                        ? "border-red-300/35 bg-red-500/20 text-red-100"
                                        : "border-red-300 bg-red-50 text-red-800"
                                    : isDark
                                        ? "border-blue-300/35 bg-blue-500/20 text-blue-100"
                                        : "border-blue-300 bg-blue-50 text-blue-800"
                        }`}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>

            {isClearCanvasModalOpen && (
                <div className="absolute inset-0 z-50 grid place-items-center bg-black/35 px-4">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="clear-canvas-title"
                        className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${
                            isDark ? "border-white/15 bg-[#1a1a1a] text-white" : "border-slate-300 bg-white text-slate-900"
                        }`}
                    >
                        <h3 id="clear-canvas-title" className="text-base font-semibold">Clear canvas?</h3>
                        <p className="mt-2 text-sm opacity-80">This removes all shapes from this room. This action cannot be undone.</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsClearCanvasModalOpen(false)}
                                className={`rounded-lg border px-3 py-2 text-sm transition ${
                                    isDark ? "border-white/20 hover:bg-white/10" : "border-slate-300 hover:bg-slate-100"
                                }`}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    confirmClearCanvas();
                                    setIsClearCanvasModalOpen(false);
                                }}
                                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                    isDark ? "border-red-300/40 bg-red-500/20 text-red-100 hover:bg-red-500/30" : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                }`}
                            >
                                Clear canvas
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} className="block h-full w-full touch-none" />
        </div>
    );
}
