"use client";
import {useEffect, useRef} from "react";
import {initDraw} from "../../draw";

export default function Canvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        initDraw(canvasRef.current);
    }, [canvasRef]);

    return (
        <div>
            {/* To interact with the canvas, we first have to extract the context */}
            <canvas ref={canvasRef} width={1080} height={1000}></canvas>
        </div>
    );
}
