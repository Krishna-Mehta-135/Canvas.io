"use client";

import {ReactNode, useEffect, useRef, useState} from "react";
import {attachEvents} from "@repo/canvas-engine";
import {CanvasState} from "@repo/canvas-engine";
import type {Tool} from "@repo/canvas-engine";

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
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const controlsRef = useRef<ReturnType<typeof attachEvents> | null>(null);
    const toolRef = useRef<Tool>("select");
    const [activeTool, setActiveTool] = useState<Tool>("select");
    const [selectedCount, setSelectedCount] = useState(0);

    useEffect(() => {
        toolRef.current = activeTool;
    }, [activeTool]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // set size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const state = new CanvasState();

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
    }, []);

    const handleDeleteSelected = () => {
        controlsRef.current?.deleteSelection();
    };

    return (
        <div className="relative h-screen w-screen bg-[#121212]">
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#191919]/95 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur">
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
                                        ? "border-[#8d8ac5] bg-[#8d8ac5]/20 text-white"
                                        : "border-transparent bg-[#232323] text-white/85 hover:border-white/20 hover:text-white"
                                }`}
                            >
                                {tool.icon}
                                <span className={`mt-1 text-[10px] ${isActive ? "text-white/90" : "text-white/55"}`}>
                                    {tool.shortcut}
                                </span>
                            </button>
                        );
                    })}
                    <div className="mx-1 h-8 w-px bg-white/10" />
                    <button
                        type="button"
                        onClick={handleDeleteSelected}
                        disabled={selectedCount === 0}
                        title="Delete selected shapes (Delete/Backspace)"
                        className={`group flex min-w-14 flex-col items-center rounded-xl border px-2 py-1.5 transition ${
                            selectedCount > 0
                                ? "border-red-300/30 bg-red-500/15 text-white hover:border-red-200/50 hover:bg-red-500/20"
                                : "cursor-not-allowed border-transparent bg-[#232323] text-white/40"
                        }`}
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                        </svg>
                        <span className={`mt-1 text-[10px] ${selectedCount > 0 ? "text-white/80" : "text-white/35"}`}>
                            Del
                        </span>
                    </button>
                </div>
            </div>
            <canvas ref={canvasRef} />
        </div>
    );
}
