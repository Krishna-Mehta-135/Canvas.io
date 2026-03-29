/*
renderer.ts

Responsible for visual output of the canvas.

Responsibilities:
- draw shapes
- draw selection UI (bounding box + resize handles)

Constraints:
- PURE rendering layer (no state mutation)
- does not handle interaction or logic
- reflects the current state onto pixels

Rendering model:
- immediate mode → entire canvas is redrawn every frame
*/

import {Shape} from "./types";

const DEFAULT_STROKE_WIDTH = 2;
const HANDLE_COLOR = "#8d8ac5";

// -------------------- DRAW MAP --------------------

/**
 * Maps shape type → corresponding draw function.
 *
 * Avoids large condition chains and keeps rendering extensible.
 */
const drawMap: {
    [K in Shape["type"]]: (ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: K}>) => void;
} = {
    rect: drawRectangle,
    circle: drawCircle,
    line: drawLine,
};

// -------------------- ROUNDED RECT --------------------

/**
 * Draws a rounded rectangle path.
 *
 * Radius is clamped so it never exceeds half the width/height.
 */
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

// -------------------- DRAW SHAPES --------------------

/**
 * Rectangle rendering with adaptive corner radius.
 *
 * Smaller shapes → smaller radius for better visual balance.
 */
function drawRectangle(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "rect"}>) {
    ctx.strokeStyle = shape.stroke || "white";
    ctx.lineWidth = DEFAULT_STROKE_WIDTH;

    const radius = Math.min(20, shape.width / 3, shape.height / 3);

    drawRoundedRect(ctx, shape.x, shape.y, shape.width, shape.height, radius);
    ctx.stroke();
}

/**
 * Ellipse rendering (supports both circle and oval).
 *
 * Uses center-based representation:
 * - centerX, centerY
 * - radiusX, radiusY
 */
function drawCircle(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "circle"}>) {
    ctx.strokeStyle = shape.stroke || "white";
    ctx.lineWidth = DEFAULT_STROKE_WIDTH;

    ctx.beginPath();
    ctx.ellipse(shape.centerX, shape.centerY, shape.radiusX, shape.radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
}

/**
 * Straight line between two points.
 *
 * Note:
 * Lines have no area → only stroke matters.
 */
function drawLine(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "line"}>) {
    ctx.strokeStyle = shape.stroke || "white";
    ctx.lineWidth = DEFAULT_STROKE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(shape.x1, shape.y1);
    ctx.lineTo(shape.x2, shape.y2);
    ctx.stroke();
}

// -------------------- BOUNDING BOX --------------------

/**
 * Computes the bounding box of a shape.
 *
 * Used for:
 * - selection outline
 * - resize handles
 *
 * Important:
 * Bounding box represents geometric limits,
 * NOT interaction logic.
 */
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
            x: shape.centerX - shape.radiusX,
            y: shape.centerY - shape.radiusY,
            width: shape.radiusX * 2,
            height: shape.radiusY * 2,
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

// -------------------- HANDLES --------------------

/**
 * Draws a resize handle.
 *
 * Handles are visual interaction points (corners of bounding box).
 */
function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const size = 8;

    ctx.fillStyle = HANDLE_COLOR;
    ctx.strokeStyle = HANDLE_COLOR;

    ctx.beginPath();
    ctx.rect(x - size / 2, y - size / 2, size, size);
    ctx.fill();
}

// -------------------- HANDLE POSITIONS --------------------

/**
 * Returns corner positions for resize handles.
 *
 * padding → pushes handles slightly outward
 * inward tweak → fine visual alignment adjustment
 */
function getHandlePoints(shape: Shape) {
    const {x, y, width, height} = getBoundingBox(shape);

    const padding = 4;
    const inward = -1;

    return [
        {x: x - padding + inward, y: y - padding + inward},
        {x: x + width + padding - inward, y: y - padding + inward},
        {x: x - padding + inward, y: y + height + padding - inward},
        {x: x + width + padding - inward, y: y + height + padding - inward},
    ];
}

// -------------------- SELECTION --------------------

/**
 * Draws selection UI:
 * - bounding box (sharp)
 * - resize handles
 *
 * Purely visual (does not affect state).
 */
function drawSelection(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.save();

    const {x, y, width, height} = getBoundingBox(shape);
    const padding = 6;

    ctx.strokeStyle = HANDLE_COLOR;
    ctx.lineWidth = 1;

    ctx.strokeRect(x - padding, y - padding, width + padding * 2, height + padding * 2);

    const handles = getHandlePoints(shape);
    handles.forEach((p) => drawHandle(ctx, p.x, p.y));

    ctx.restore();
}

// -------------------- RENDER --------------------

/**
 * Main render loop.
 *
 * Flow:
 * 1. Clear canvas (background fill)
 * 2. Draw all shapes
 * 3. Draw selection overlay
 *
 * Rendering is full redraw every frame (no retained state).
 */
export function render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    shapes: Shape[],
    selectedShape: Shape | null
) {
    // Background
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    shapes.forEach((shape) => {
        const drawFn = drawMap[shape.type];
        if (!drawFn) return;

        drawFn(ctx, shape as any);

        if (selectedShape === shape) {
            drawSelection(ctx, shape);
        }
    });
}
