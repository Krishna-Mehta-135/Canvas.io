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
import {getWrappedTextLines} from "./textLayout";

const DEFAULT_STROKE_WIDTH = 2;
const HANDLE_COLOR = "#8d8ac5";
const SELECTION_PADDING = 6;
const HANDLE_SIZE = 12;

function getThemePalette() {
    if (typeof document === "undefined") {
        return {
            background: "#121212",
            stroke: "#f8fafc",
        };
    }

    const theme = document.documentElement.getAttribute("data-theme");
    if (theme === "light") {
        return {
            background: "#f8f9fb",
            stroke: "#1f2937",
        };
    }

    return {
        background: "#121212",
        stroke: "#f8fafc",
    };
}

type SelectionBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

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
    text: drawText,
    freehand: drawFreehand,
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
    ctx.strokeStyle = shape.stroke || getThemePalette().stroke;
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
    ctx.strokeStyle = shape.stroke || getThemePalette().stroke;
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
    ctx.strokeStyle = shape.stroke || getThemePalette().stroke;
    ctx.lineWidth = DEFAULT_STROKE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(shape.x1, shape.y1);
    ctx.lineTo(shape.x2, shape.y2);
    ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "text"}>) {
    ctx.fillStyle = shape.stroke || getThemePalette().stroke;
    ctx.font = `${shape.fontSize}px Virgil, Caveat, ui-rounded, sans-serif`;
    ctx.textBaseline = "top";

    const lineHeight = shape.fontSize * 1.25;
    const wrappedLines = getWrappedTextLines(ctx, shape.text, shape.width);

    wrappedLines.forEach((line, index) => {
        const y = shape.y + index * lineHeight;
        ctx.fillText(line, shape.x, y);
    });
}

function drawFreehand(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "freehand"}>) {
    if (shape.points.length < 2) return;

    ctx.strokeStyle = shape.stroke || getThemePalette().stroke;
    ctx.lineWidth = DEFAULT_STROKE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(shape.points[0]!.x, shape.points[0]!.y);

    for (let i = 1; i < shape.points.length; i++) {
        const point = shape.points[i];
        if (!point) continue;
        ctx.lineTo(point.x, point.y);
    }

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

    if (shape.type === "text") {
        return {
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
        };
    }

    if (shape.type === "freehand") {
        if (shape.points.length === 0) {
            return {x: 0, y: 0, width: 0, height: 0};
        }

        const xs = shape.points.map((point) => point.x);
        const ys = shape.points.map((point) => point.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
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
    ctx.fillStyle = HANDLE_COLOR;
    ctx.strokeStyle = HANDLE_COLOR;

    ctx.beginPath();
    ctx.rect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
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
    if (shape.type === "line") {
        return [
            {x: shape.x1, y: shape.y1},
            {x: shape.x2, y: shape.y2},
        ];
    }

    const {x, y, width, height} = getBoundingBox(shape);
    const x1 = x - SELECTION_PADDING;
    const y1 = y - SELECTION_PADDING;
    const x2 = x + width + SELECTION_PADDING;
    const y2 = y + height + SELECTION_PADDING;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    return [
        {x: x1, y: y1},
        {x: x2, y: y1},
        {x: x1, y: y2},
        {x: x2, y: y2},
        {x: x1, y: centerY},
        {x: x2, y: centerY},
        {x: centerX, y: y1},
        {x: centerX, y: y2},
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

    ctx.strokeStyle = HANDLE_COLOR;
    ctx.lineWidth = 1;

    ctx.strokeRect(
        x - SELECTION_PADDING,
        y - SELECTION_PADDING,
        width + SELECTION_PADDING * 2,
        height + SELECTION_PADDING * 2
    );
    
    const handles = getHandlePoints(shape);
    handles.forEach((p) => drawHandle(ctx, p.x, p.y));

    ctx.restore();
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, selectionBox: SelectionBox) {
    ctx.save();

    ctx.strokeStyle = HANDLE_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);

    ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);

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
    selectedShape: Shape | null,
    selectionBox: SelectionBox | null = null,
    selectedShapes: Shape[] = []
) {
    const palette = getThemePalette();

    // Background
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    shapes.forEach((shape) => {
        const drawFn = drawMap[shape.type];
        if (!drawFn) return;

        drawFn(ctx, shape as any);
    });

    selectedShapes.forEach((shape) => {
        if (shape === selectedShape) return;
        drawSelection(ctx, shape);
    });

    if (selectedShape) {
        const primary = shapes.find((shape) => shape.id === selectedShape.id);
        if (primary) {
            drawSelection(ctx, primary);
        }
    }

    if (selectionBox) {
        drawSelectionBox(ctx, selectionBox);
    }
}
