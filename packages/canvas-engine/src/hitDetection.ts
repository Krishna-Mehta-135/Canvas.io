/*
hitDetection.ts

Legacy hit-detection module kept for compatibility during migration.

Responsibilities:
- shape hit-testing by pointer location
- resize-handle hit-testing

Preferred location for new usage: src/interaction/hitDetection.ts
*/

import {Handle, Shape} from "./types";

/**
 * Pixel tolerance for hit detection
 */
const HIT_THRESHOLD = 5;
const HANDLE_SIZE = 10;

/* ---------------- SHAPE HIT ---------------- */

function hitRect(shape: Extract<Shape, {type: "rect"}>, x: number, y: number) {
    return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
}

function hitEllipse(shape: Extract<Shape, {type: "circle"}>, x: number, y: number) {
    const dx = x - shape.centerX;
    const dy = y - shape.centerY;

    const rx = shape.radiusX;
    const ry = shape.radiusY;

    if (rx === 0 || ry === 0) return false;

    const value = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);

    return value <= 1;
}

function hitLine(shape: Extract<Shape, {type: "line"}>, x: number, y: number) {
    const dx = shape.x2 - shape.x1;
    const dy = shape.y2 - shape.y1;

    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return false;

    const distance = Math.abs(dy * x - dx * y + shape.x2 * shape.y1 - shape.y2 * shape.x1) / length;

    return distance < HIT_THRESHOLD;
}

function hitText(shape: Extract<Shape, {type: "text"}>, x: number, y: number) {
    return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
}

function hitFreehand(shape: Extract<Shape, {type: "freehand"}>, x: number, y: number) {
    if (shape.points.length < 2) return false;

    for (let i = 1; i < shape.points.length; i++) {
        const p1 = shape.points[i - 1];
        const p2 = shape.points[i];
        if (!p1 || !p2) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;

        const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq));
        const projX = p1.x + t * dx;
        const projY = p1.y + t * dy;

        const distX = x - projX;
        const distY = y - projY;
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance <= HIT_THRESHOLD + 2) {
            return true;
        }
    }

    return false;
}

const hitMap = {
    rect: hitRect,
    circle: hitEllipse,
    line: hitLine,
    text: hitText,
    freehand: hitFreehand,
};

/* ---------------- SHAPE DETECTION ---------------- */

export function getShapeAtPoint(shapes: Shape[], x: number, y: number): Shape | null {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!shape) continue;

        const fn = hitMap[shape.type];
        if (fn(shape as any, x, y)) return shape;
    }

    return null;
}

/* ---------------- HANDLE DETECTION ---------------- */

export function getHandleAtPoint(shape: Shape, x: number, y: number, padding = 0): Handle | null {
    // RECT
    if (shape.type === "rect") {
        return getBoxHandle(
            shape.x - padding,
            shape.y - padding,
            shape.x + shape.width + padding,
            shape.y + shape.height + padding,
            x,
            y
        );
    }

    // CIRCLE (uses bounding box)
    if (shape.type === "circle") {
        const x1 = shape.centerX - shape.radiusX - padding;
        const y1 = shape.centerY - shape.radiusY - padding;
        const x2 = shape.centerX + shape.radiusX + padding;
        const y2 = shape.centerY + shape.radiusY + padding;

        return getBoxHandle(x1, y1, x2, y2, x, y);
    }

    if (shape.type === "text") {
        return getBoxHandle(
            shape.x - padding,
            shape.y - padding,
            shape.x + shape.width + padding,
            shape.y + shape.height + padding,
            x,
            y
        );
    }

    if (shape.type === "freehand") {
        if (shape.points.length === 0) return null;

        const xs = shape.points.map((point) => point.x);
        const ys = shape.points.map((point) => point.y);

        const x1 = Math.min(...xs) - padding;
        const y1 = Math.min(...ys) - padding;
        const x2 = Math.max(...xs) + padding;
        const y2 = Math.max(...ys) + padding;

        return getBoxHandle(x1, y1, x2, y2, x, y);
    }

    // LINE (endpoints only)
    if (shape.type === "line") {
        if (Math.abs(x - shape.x1) <= HANDLE_SIZE && Math.abs(y - shape.y1) <= HANDLE_SIZE) {
            return "start";
        }

        if (Math.abs(x - shape.x2) <= HANDLE_SIZE && Math.abs(y - shape.y2) <= HANDLE_SIZE) {
            return "end";
        }
    }

    return null;
}

/* ---------------- BOX HANDLES ---------------- */

function getBoxHandle(x1: number, y1: number, x2: number, y2: number, x: number, y: number): Handle | null {
    const handles = {
        "top-left": [x1, y1],
        "top-right": [x2, y1],
        "bottom-left": [x1, y2],
        "bottom-right": [x2, y2],
        left: [x1, (y1 + y2) / 2],
        right: [x2, (y1 + y2) / 2],
        top: [(x1 + x2) / 2, y1],
        bottom: [(x1 + x2) / 2, y2],
    } as const;

    for (const [handle, [hx, hy]] of Object.entries(handles)) {
        if (Math.abs(x - hx) <= HANDLE_SIZE && Math.abs(y - hy) <= HANDLE_SIZE) {
            return handle as Handle;
        }
    }

    return null;
}
