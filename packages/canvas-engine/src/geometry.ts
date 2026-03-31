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

type ResizeOptions = {
    fromCenter?: boolean;
    preserveAspect?: boolean;
};

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

    if (shape.type === "text") {
        return {
            x1: shape.x,
            y1: shape.y,
            x2: shape.x + shape.width,
            y2: shape.y + shape.height,
        };
    }

    if (shape.type === "freehand") {
        if (shape.points.length === 0) {
            return {
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0,
            };
        }

        const xs = shape.points.map((point) => point.x);
        const ys = shape.points.map((point) => point.y);

        return {
            x1: Math.min(...xs),
            y1: Math.min(...ys),
            x2: Math.max(...xs),
            y2: Math.max(...ys),
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

    if (shape.type === "text") {
        const oldHeight = Math.max(1, shape.height);
        const nextHeight = Math.max(8, y2 - y1);
        const heightScale = nextHeight / oldHeight;

        // Use the full resize bounds for width and position (like rect)
        // Font size scales with height to maintain readability
        return {
            x: x1,
            y: y1,
            width: Math.max(8, x2 - x1),
            height: nextHeight,
            fontSize: Math.max(8, shape.fontSize * heightScale),
        };
    }

    if (shape.type === "freehand") {
        return {
            points: shape.points,
        };
    }

    throw new Error("Unknown shape");
}

/* ---------------- RESIZE ---------------- */

export function resizeShape(shape: Shape, handle: Handle, x: number, y: number, options: ResizeOptions = {}) {
    const {fromCenter = false, preserveAspect = false} = options;

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

    const original = convertToPoints(shape);
    let {x1, y1, x2, y2} = original;
    const centerX = (original.x1 + original.x2) / 2;
    const centerY = (original.y1 + original.y2) / 2;

    if (fromCenter) {
        switch (handle) {
            case "top-left":
                x1 = x;
                y1 = y;
                x2 = centerX * 2 - x;
                y2 = centerY * 2 - y;
                break;
            case "top-right":
                x2 = x;
                y1 = y;
                x1 = centerX * 2 - x;
                y2 = centerY * 2 - y;
                break;
            case "bottom-left":
                x1 = x;
                y2 = y;
                x2 = centerX * 2 - x;
                y1 = centerY * 2 - y;
                break;
            case "bottom-right":
                x2 = x;
                y2 = y;
                x1 = centerX * 2 - x;
                y1 = centerY * 2 - y;
                break;
            case "left":
                x1 = x;
                x2 = centerX * 2 - x;
                break;
            case "right":
                x2 = x;
                x1 = centerX * 2 - x;
                break;
            case "top":
                y1 = y;
                y2 = centerY * 2 - y;
                break;
            case "bottom":
                y2 = y;
                y1 = centerY * 2 - y;
                break;
        }
    } else {
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
    }

    if (preserveAspect) {
        if (fromCenter) {
            const size = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
            x1 = centerX - size / 2;
            x2 = centerX + size / 2;
            y1 = centerY - size / 2;
            y2 = centerY + size / 2;
        } else {
            const isCornerHandle =
                handle === "top-left" ||
                handle === "top-right" ||
                handle === "bottom-left" ||
                handle === "bottom-right";

            if (isCornerHandle) {
                let fixedX = original.x1;
                let fixedY = original.y1;

                if (handle === "top-left") {
                    fixedX = original.x2;
                    fixedY = original.y2;
                }

                if (handle === "top-right") {
                    fixedX = original.x1;
                    fixedY = original.y2;
                }

                if (handle === "bottom-left") {
                    fixedX = original.x2;
                    fixedY = original.y1;
                }

                if (handle === "bottom-right") {
                    fixedX = original.x1;
                    fixedY = original.y1;
                }

                const draggedX =
                    handle === "top-left" || handle === "bottom-left" ? x1 : x2;
                const draggedY =
                    handle === "top-left" || handle === "top-right" ? y1 : y2;

                const deltaX = draggedX - fixedX;
                const deltaY = draggedY - fixedY;
                const size = Math.max(Math.abs(deltaX), Math.abs(deltaY));

                const nextDraggedX = fixedX + Math.sign(deltaX || 1) * size;
                const nextDraggedY = fixedY + Math.sign(deltaY || 1) * size;

                if (handle === "top-left") {
                    x1 = nextDraggedX;
                    y1 = nextDraggedY;
                    x2 = fixedX;
                    y2 = fixedY;
                }

                if (handle === "top-right") {
                    x2 = nextDraggedX;
                    y1 = nextDraggedY;
                    x1 = fixedX;
                    y2 = fixedY;
                }

                if (handle === "bottom-left") {
                    x1 = nextDraggedX;
                    y2 = nextDraggedY;
                    x2 = fixedX;
                    y1 = fixedY;
                }

                if (handle === "bottom-right") {
                    x2 = nextDraggedX;
                    y2 = nextDraggedY;
                    x1 = fixedX;
                    y1 = fixedY;
                }
            }
        }
    }

    const normalized = normalize({x1, y1, x2, y2});

    if (shape.type === "text") {
        const oldHeight = Math.max(1, shape.height);
        const nextHeight = Math.max(8, normalized.y2 - normalized.y1);
        const heightScale = nextHeight / oldHeight;
        const nextFontSize = Math.max(8, shape.fontSize * heightScale);

        const lines = shape.text.split("\n");
        const longestLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);

        // Approximate text content bounds to avoid shrinking selection below readable text.
        const minWidth = Math.max(8, longestLineLength * nextFontSize * 0.62 + 8);
        const lineHeight = nextFontSize * 1.25;
        const minHeight = Math.max(lineHeight, lines.length * lineHeight);

        let nextX = normalized.x1;
        let nextY = normalized.y1;
        let nextWidth = normalized.x2 - normalized.x1;
        let nextHeightClamped = nextHeight;

        if (nextWidth < minWidth) {
            const isLeftHandle = handle === "left" || handle === "top-left" || handle === "bottom-left";
            const isCenterResize = fromCenter;

            if (isLeftHandle) {
                nextX = normalized.x2 - minWidth;
            } else if (isCenterResize) {
                const centerX = (normalized.x1 + normalized.x2) / 2;
                nextX = centerX - minWidth / 2;
            }

            nextWidth = minWidth;
        }

        if (nextHeightClamped < minHeight) {
            const isTopHandle = handle === "top" || handle === "top-left" || handle === "top-right";
            const isCenterResize = fromCenter;

            if (isTopHandle) {
                nextY = normalized.y2 - minHeight;
            } else if (isCenterResize) {
                const centerY = (normalized.y1 + normalized.y2) / 2;
                nextY = centerY - minHeight / 2;
            }

            nextHeightClamped = minHeight;
        }

        return {
            x: nextX,
            y: nextY,
            width: nextWidth,
            height: nextHeightClamped,
            fontSize: nextFontSize,
        };
    }

    if (shape.type === "freehand") {
        const source = convertToPoints(shape);
        const sourceWidth = Math.max(1, source.x2 - source.x1);
        const sourceHeight = Math.max(1, source.y2 - source.y1);
        const targetWidth = normalized.x2 - normalized.x1;
        const targetHeight = normalized.y2 - normalized.y1;

        return {
            points: shape.points.map((point) => ({
                x: normalized.x1 + ((point.x - source.x1) / sourceWidth) * targetWidth,
                y: normalized.y1 + ((point.y - source.y1) / sourceHeight) * targetHeight,
            })),
        };
    }

    return convertBackToShape(shape, normalized);
}
