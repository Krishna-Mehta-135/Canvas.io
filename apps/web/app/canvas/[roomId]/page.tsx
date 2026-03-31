"use client";

import {useEffect, useRef, useState} from "react";
import {attachEvents} from "@repo/canvas-engine";
import {CanvasState} from "@repo/canvas-engine";
import type {Tool} from "@repo/canvas-engine";

const TOOLS: Array<{id: Tool; label: string}> = [
    {id: "select", label: "Select"},
    {id: "rect", label: "Rect"},
    {id: "circle", label: "Circle"},
    {id: "line", label: "Line"},
];

export default function CanvasPage() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const toolRef = useRef<Tool>("select");
    const [activeTool, setActiveTool] = useState<Tool>("select");

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

        attachEvents(canvas, ctx, state, {
            getTool: () => toolRef.current,
            onToolChange: (tool) => {
                toolRef.current = tool;
                setActiveTool(tool);
            },
        });
    }, []);

    return (
        <div className="relative h-screen w-screen bg-[#121212]">
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1a1a1a]/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur">
                <div className="flex items-center gap-2">
                    {TOOLS.map((tool) => {
                        const isActive = activeTool === tool.id;

                        return (
                            <button
                                key={tool.id}
                                type="button"
                                onClick={() => setActiveTool(tool.id)}
                                className={`rounded-xl border px-3 py-2 text-sm transition ${
                                    isActive
                                        ? "border-[#8d8ac5] bg-[#8d8ac5] text-white"
                                        : "border-white/10 bg-[#232323] text-white/80 hover:border-white/20 hover:text-white"
                                }`}
                            >
                                {tool.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <canvas ref={canvasRef} />
        </div>
    );
}
