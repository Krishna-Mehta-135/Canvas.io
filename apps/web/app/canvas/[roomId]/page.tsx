"use client";

import {useEffect, useRef} from "react";
import {attachEvents} from "@repo/canvas-engine";
import {CanvasState} from "@repo/canvas-engine";
export default function CanvasPage() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // set size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const state = new CanvasState();

        attachEvents(canvas, ctx, state);
    }, []);

    return (
        <div className="h-screen w-screen bg-[#121212]">
            <canvas ref={canvasRef} />
        </div>
    );
}
