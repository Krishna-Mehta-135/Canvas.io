/*
geometry.ts

Pure transformation layer.

Each shape uses correct interaction model:

- Rect   → bounding box + normalize
- Circle → bounding box + derive center/radius (NOT center-based resize)
- Line   → endpoints only (NO normalize)

NEVER mix responsibilities.
*/

import {Shape, Handle} from "./types";

/* ---------------- CONVERT ---------------- */

export function convertToPoints(shape: Shape) {
    if (shape.type === "rect") {
        return {
            x1: shape.x,
            y1: shape.y,
            x2: shape.x + shape.width,
            y2: shape.y + shape.height,
        };
    }

    if (shape.type === "circle") {
        return {
            x1: shape.centerX - shape.radiusX,
            y1: shape.centerY - shape.radiusY,
            x2: shape.centerX + shape.radiusX,
            y2: shape.centerY + shape.radiusY,
        };
    }

    if (shape.type === "line") {
        return {
            x1: shape.x1,
            y1: shape.y1,
            x2: shape.x2,
            y2: shape.y2,
        };
    }

    throw new Error("Unknown shape");
}

/* ---------------- NORMALIZE ---------------- */

export function normalize({x1, y1, x2, y2}: any) {
    return {
        x1: Math.min(x1, x2),
        y1: Math.min(y1, y2),
        x2: Math.max(x1, x2),
        y2: Math.max(y1, y2),
    };
}

/* ---------------- CONVERT BACK ---------------- */

export function convertBackToShape(shape: Shape, box: any) {
    const {x1, y1, x2, y2} = box;

    if (shape.type === "rect") {
        return {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
        };
    }

    if (shape.type === "circle") {
        return {
            centerX: (x1 + x2) / 2,
            centerY: (y1 + y2) / 2,
            radiusX: (x2 - x1) / 2,
            radiusY: (y2 - y1) / 2,
        };
    }

    if (shape.type === "line") {
        return {
            x1,
            y1,
            x2,
            y2,
        };
    }

    throw new Error("Unknown shape");
}

/* ---------------- RESIZE ---------------- */

export function resizeShape(shape: Shape, handle: Handle, x: number, y: number) {
    // ================= LINE =================
    if (shape.type === "line") {
        if (handle === "start") {
            return {
                x1: x,
                y1: y,
                x2: shape.x2,
                y2: shape.y2,
            };
        }

        if (handle === "end") {
            return {
                x1: shape.x1,
                y1: shape.y1,
                x2: x,
                y2: y,
            };
        }

        return shape;
    }

    // ================= RECT + CIRCLE (SAME LOGIC) =================

    let {x1, y1, x2, y2} = convertToPoints(shape);

    switch (handle) {
        case "top-left":
            x1 = x;
            y1 = y;
            break;
        case "top-right":
            x2 = x;
            y1 = y;
            break;
        case "bottom-left":
            x1 = x;
            y2 = y;
            break;
        case "bottom-right":
            x2 = x;
            y2 = y;
            break;
        case "left":
            x1 = x;
            break;
        case "right":
            x2 = x;
            break;
        case "top":
            y1 = y;
            break;
        case "bottom":
            y2 = y;
            break;
    }

    const normalized = normalize({x1, y1, x2, y2});

    return convertBackToShape(shape, normalized);
}
