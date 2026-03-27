import {Shape} from "./types";

/**
 * Pixel tolerance for hit detection.
 * This is NOT the visual stroke width.
 * It defines how close the cursor must be to consider a "hit".
 */
const HIT_THRESHOLD = 5;

/**
 * Rectangle hit detection (stroke-based).
 *
 * Instead of checking if the point lies inside the rectangle,
 * we check if it is close to any of the four edges.
 *
 * This mimics tools like Excalidraw where only the border is interactive.
 */
function hitRect(shape: Extract<Shape, {type: "rect"}>, x: number, y: number): boolean {
    // inside
    const inside = x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;

    if (inside) return true;

    // edge (existing logic)
    const left = Math.abs(x - shape.x) < HIT_THRESHOLD && y >= shape.y && y <= shape.y + shape.height;

    const right = Math.abs(x - (shape.x + shape.width)) < HIT_THRESHOLD && y >= shape.y && y <= shape.y + shape.height;

    const top = Math.abs(y - shape.y) < HIT_THRESHOLD && x >= shape.x && x <= shape.x + shape.width;

    const bottom = Math.abs(y - (shape.y + shape.height)) < HIT_THRESHOLD && x >= shape.x && x <= shape.x + shape.width;

    return left || right || top || bottom;
}

/**
 * Circle hit detection (stroke-based).
 *
 * We compute the distance from the point to the center,
 * and check if it lies close to the circumference.
 *
 * |distance - radius| < threshold
 */
function hitEllipse(shape: Extract<Shape, {type: "circle"}>, x: number, y: number): boolean {
    const dx = x - shape.centerX;
    const dy = y - shape.centerY;

    const rx = shape.radiusX;
    const ry = shape.radiusY;

    if (rx === 0 || ry === 0) return false;

    const value = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);

    // inside
    if (value <= 1) return true;

    // edge (optional tolerance)
    return Math.abs(value - 1) < 0.1;
}

/**
 * Line hit detection.
 *
 * Since a line has no area, we compute the shortest distance
 * from the point to the line segment and compare it with threshold.
 *
 * Formula used: distance from point to line
 */
function hitLine(shape: Extract<Shape, {type: "line"}>, x: number, y: number): boolean {
    const dx = shape.x2 - shape.x1;
    const dy = shape.y2 - shape.y1;

    const length = Math.sqrt(dx * dx + dy * dy);

    // Prevent division by zero for extremely small lines
    if (length === 0) return false;

    const distance = Math.abs(dy * x - dx * y + shape.x2 * shape.y1 - shape.y2 * shape.x1) / length;

    return distance < HIT_THRESHOLD;
}

/**
 * Maps shape type → corresponding hit detection function.
 *
 * This avoids multiple if/else blocks and keeps logic scalable.
 */
const hitMap: {
    [K in Shape["type"]]: (shape: Extract<Shape, {type: K}>, x: number, y: number) => boolean;
} = {
    rect: hitRect,
    circle: hitEllipse,
    line: hitLine,
};

/**
 * Returns the topmost shape under the given point.
 *
 * Iterates in reverse order because:
 * - later shapes are drawn on top
 * - so they should be checked first
 */
export function getShapeAtPoint(shapes: Shape[], x: number, y: number): Shape | null {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!shape) continue;

        const fn = hitMap[shape.type];

        // TypeScript cannot infer the exact shape type here,
        // so we use a controlled cast.
        if (fn(shape as any, x, y)) {
            return shape;
        }
    }

    return null;
}
