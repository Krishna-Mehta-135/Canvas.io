/*
Responsibilities of renderer :-
1. Clear canvas
2. Loop over shapes
3. Draw each shape

Renderer is a deterministic function:
Same inputs → same visual output on canvas
*/

import {Shape} from "./types";

const DEFAULT_STROKE_WIDTH = 2;

const drawMap: {
    [K in Shape["type"]]: (ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: K}>) => void;
} = {
    rect: drawRectangle,
    circle: drawCircle,
    line: drawLine,
};

// -------------------- DRAW SHAPES --------------------

function drawRectangle(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "rect"}>) {
    ctx.strokeStyle = shape.stroke || "white";
    ctx.lineWidth = DEFAULT_STROKE_WIDTH;

    drawRoundedRect(ctx, shape.x, shape.y, shape.width, shape.height, 12);

    ctx.stroke();
}

function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawCircle(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "circle"}>) {
    ctx.strokeStyle = shape.stroke || "white";
    ctx.lineWidth = DEFAULT_STROKE_WIDTH;

    ctx.beginPath();
    ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
    ctx.stroke();
}

function drawLine(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "line"}>) {
    ctx.strokeStyle = shape.stroke || "white";
    ctx.lineWidth = DEFAULT_STROKE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(shape.x1, shape.y1);
    ctx.lineTo(shape.x2, shape.y2);
    ctx.stroke();
}

// -------------------- BOUNDING BOX --------------------

function getBoundingBox(shape: Shape) {
    if (shape.type === "rect") {
        return {
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
        };
    }

    if (shape.type === "circle") {
        return {
            x: shape.centerX - shape.radius,
            y: shape.centerY - shape.radius,
            width: shape.radius * 2,
            height: shape.radius * 2,
        };
    }

    if (shape.type === "line") {
        const x = Math.min(shape.x1, shape.x2);
        const y = Math.min(shape.y1, shape.y2);
        const width = Math.abs(shape.x2 - shape.x1);
        const height = Math.abs(shape.y2 - shape.y1);

        return {x, y, width, height};
    }

    throw new Error("Unknown shape");
}

// -------------------- SELECTION --------------------

function drawSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.save();

    const {x, y, width, height} = getBoundingBox(shape);

    const padding = 6;

    ctx.strokeStyle = "#4da3ff";
    ctx.lineWidth = 1;

    ctx.strokeRect(x - padding, y - padding, width + padding * 2, height + padding * 2);

    ctx.restore();
}

// -------------------- RENDER --------------------

export function render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    shapes: Shape[],
    selectedShape: Shape | null
) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    shapes.forEach((shape) => {
        const drawFn = drawMap[shape.type];
        if (!drawFn) return;

        drawFn(ctx, shape as any);

        if (selectedShape === shape) {
            drawSelection(ctx, shape);
        }
    });
}
