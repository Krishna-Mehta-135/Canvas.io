/*
Responsibilities of renderer :-
1. Clear canvas
2. Loop over shapes
3. Draw each shape

Renderer is a deterministic function:
Same inputs → same visual output on canvas
*/

import {Shape} from "./types";

const drawMap: {
    [K in Shape["type"]]: (ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: K}>) => void;
} = {
    rect: drawRectangle,
    circle: drawCircle,
};

function drawRectangle(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "rect"}>) {
    ctx.strokeStyle = shape.stroke || "white";
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
}

function drawCircle(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "circle"}>) {
    ctx.strokeStyle = shape.stroke || "white";
    ctx.beginPath();
    ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
    ctx.stroke();
}

export function render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, shapes: Shape[]) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    shapes.forEach((shape) => {
        const drawFn = drawMap[shape.type];
        if (!drawFn) return;

        drawFn(ctx, shape as any);
    });
}
