import {Handle, Shape} from "./types";

/**
 * Pixel tolerance for hit detection
 */
const HIT_THRESHOLD = 5;

/**
 * Rectangle hit detection
 */
function hitRect(shape: Extract<Shape, {type: "rect"}>, x: number, y: number): boolean {
    const inside = x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;

    if (inside) return true;

    const left = Math.abs(x - shape.x) < HIT_THRESHOLD;
    const right = Math.abs(x - (shape.x + shape.width)) < HIT_THRESHOLD;
    const top = Math.abs(y - shape.y) < HIT_THRESHOLD;
    const bottom = Math.abs(y - (shape.y + shape.height)) < HIT_THRESHOLD;

    return left || right || top || bottom;
}

/**
 * Ellipse hit detection
 */
function hitEllipse(shape: Extract<Shape, {type: "circle"}>, x: number, y: number): boolean {
    const dx = x - shape.centerX;
    const dy = y - shape.centerY;

    const rx = shape.radiusX;
    const ry = shape.radiusY;

    if (rx === 0 || ry === 0) return false;

    const value = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);

    if (value <= 1) return true;

    return Math.abs(value - 1) < 0.1;
}

/**
 * Line hit detection
 */
function hitLine(shape: Extract<Shape, {type: "line"}>, x: number, y: number): boolean {
    const dx = shape.x2 - shape.x1;
    const dy = shape.y2 - shape.y1;

    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return false;

    const distance = Math.abs(dy * x - dx * y + shape.x2 * shape.y1 - shape.y2 * shape.x1) / length;

    return distance < HIT_THRESHOLD;
}

/**
 * Map
 */
const hitMap = {
    rect: hitRect,
    circle: hitEllipse,
    line: hitLine,
};

/**
 * Topmost shape detection
 */
export function getShapeAtPoint(shapes: Shape[], x: number, y: number): Shape | null {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!shape) continue;

        const fn = hitMap[shape.type];
        if (fn(shape as any, x, y)) return shape;
    }

    return null;
}

/**
 * HANDLE DETECTION
 */
const HANDLE_SIZE = 8;

export function getHandleAtPoint(shape: Shape, x: number, y: number): Handle | null {
    // ---------- RECT ----------
    if (shape.type === "rect") {
        return getBoxHandle(shape.x, shape.y, shape.x + shape.width, shape.y + shape.height, x, y);
    }

    // ---------- CIRCLE ----------
    if (shape.type === "circle") {
        const x1 = shape.centerX - shape.radiusX;
        const y1 = shape.centerY - shape.radiusY;
        const x2 = shape.centerX + shape.radiusX;
        const y2 = shape.centerY + shape.radiusY;

        return getBoxHandle(x1, y1, x2, y2, x, y);
    }

    // ---------- LINE ----------
    if (shape.type === "line") {
        const startHit = Math.abs(x - shape.x1) <= HANDLE_SIZE && Math.abs(y - shape.y1) <= HANDLE_SIZE;

        if (startHit) return "start";

        const endHit = Math.abs(x - shape.x2) <= HANDLE_SIZE && Math.abs(y - shape.y2) <= HANDLE_SIZE;

        if (endHit) return "end";
    }

    return null;
}

/**
 * Shared bounding-box handle logic
 */
function getBoxHandle(x1: number, y1: number, x2: number, y2: number, x: number, y: number): Handle | null {
    const HANDLE_SIZE = 6; 

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
