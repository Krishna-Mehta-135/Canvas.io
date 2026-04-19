/*
interaction/hitDetection.ts

Interaction-layer hit testing.

Responsibilities:
- find top-most shape under the pointer
- resolve which resize handle (if any) is being targeted

Used by:
- events.ts for selection and text/edit targeting
- interaction/resizeTarget.ts for resize initiation
*/

import {Handle, Shape} from "../types";
import {getTextRenderMetrics} from "../textMetrics";

/**
 * Pixel tolerance for hit detection
 */
const HIT_THRESHOLD = 5;
const HANDLE_SIZE = 10;
const CONNECTOR_HANDLE_SIZE = 6;

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

function hitRhombus(shape: Extract<Shape, {type: "rhombus"}>, x: number, y: number) {
    if (shape.width <= 0 || shape.height <= 0) return false;

    const centerX = shape.x + shape.width / 2;
    const centerY = shape.y + shape.height / 2;
    const dx = Math.abs(x - centerX);
    const dy = Math.abs(y - centerY);

    return dx / (shape.width / 2) + dy / (shape.height / 2) <= 1;
}

function hitConnector(shape: Extract<Shape, {type: "line" | "arrow"}>, x: number, y: number) {
    const dx = shape.x2 - shape.x1;
    const dy = shape.y2 - shape.y1;

    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return false;

    // Project the pointer onto the connector segment (not the infinite line)
    // so move/hover only activates when cursor is actually over the shape.
    const t = Math.max(0, Math.min(1, ((x - shape.x1) * dx + (y - shape.y1) * dy) / lenSq));
    const projX = shape.x1 + t * dx;
    const projY = shape.y1 + t * dy;

    const distX = x - projX;
    const distY = y - projY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    return distance < HIT_THRESHOLD;
}

function hitText(shape: Extract<Shape, {type: "text"}>, x: number, y: number, ctx?: CanvasRenderingContext2D) {
    if (!ctx) {
        return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
    }

    const {textWidth, textHeight} = getTextRenderMetrics(ctx, shape);
    return x >= shape.x && x <= shape.x + textWidth && y >= shape.y && y <= shape.y + textHeight;
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
    rhombus: hitRhombus,
    line: hitConnector,
    arrow: hitConnector,
    text: hitText,
    freehand: hitFreehand,
};

/* ---------------- SHAPE DETECTION ---------------- */

export function getShapeAtPoint(shapes: Shape[], x: number, y: number, ctx?: CanvasRenderingContext2D): Shape | null {
    return getShapesAtPoint(shapes, x, y, ctx)[0] ?? null;
}

export function getShapesAtPoint(shapes: Shape[], x: number, y: number, ctx?: CanvasRenderingContext2D): Shape[] {
    const hits: Shape[] = [];

    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!shape) continue;

        const fn = hitMap[shape.type];
        if (fn(shape as any, x, y, ctx)) {
            hits.push(shape);
        }
    }

    return hits;
}

/* ---------------- HANDLE DETECTION ---------------- */

export function getHandleAtPoint(
    shape: Shape,
    x: number,
    y: number,
    padding = 0,
    ctx?: CanvasRenderingContext2D
): Handle | null {
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

    if (shape.type === "rhombus") {
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
        const bounds = ctx
            ? (() => {
                  const {textWidth, textHeight} = getTextRenderMetrics(ctx, shape);
                  return {
                      width: textWidth,
                      height: textHeight,
                  };
              })()
            : {
                  width: shape.width,
                  height: shape.height,
              };

        return getBoxHandle(
            shape.x - padding,
            shape.y - padding,
            shape.x + bounds.width + padding,
            shape.y + bounds.height + padding,
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
    if (shape.type === "line" || shape.type === "arrow") {
        if (Math.abs(x - shape.x1) <= CONNECTOR_HANDLE_SIZE && Math.abs(y - shape.y1) <= CONNECTOR_HANDLE_SIZE) {
            return "start";
        }

        if (Math.abs(x - shape.x2) <= CONNECTOR_HANDLE_SIZE && Math.abs(y - shape.y2) <= CONNECTOR_HANDLE_SIZE) {
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
