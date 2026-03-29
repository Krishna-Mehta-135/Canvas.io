import {Shape} from "./types";

/**
 * Pixel tolerance for hit detection.
 *
 * This is NOT the visual stroke width.
 * It defines how close the cursor must be to a shape's boundary
 * to consider it a "hit".
 */
const HIT_THRESHOLD = 5;

/**
 * Rectangle hit detection.
 *
 * We support BOTH:
 * 1. Inside detection → allows clicking anywhere inside the shape
 * 2. Edge detection → allows grabbing borders easily
 *
 * This creates a natural UX similar to modern editors:
 * - click inside → move
 * - click near edge → also move (later resize)
 */
function hitRect(shape: Extract<Shape, {type: "rect"}>, x: number, y: number): boolean {
    // Inside detection (area-based)
    const inside = x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;

    if (inside) return true;

    // Edge detection (stroke-like behavior)
    const left = Math.abs(x - shape.x) < HIT_THRESHOLD && y >= shape.y && y <= shape.y + shape.height;

    const right = Math.abs(x - (shape.x + shape.width)) < HIT_THRESHOLD && y >= shape.y && y <= shape.y + shape.height;

    const top = Math.abs(y - shape.y) < HIT_THRESHOLD && x >= shape.x && x <= shape.x + shape.width;

    const bottom = Math.abs(y - (shape.y + shape.height)) < HIT_THRESHOLD && x >= shape.x && x <= shape.x + shape.width;

    return left || right || top || bottom;
}

/**
 * Ellipse (circle/oval) hit detection.
 *
 * Uses the normalized ellipse equation:
 *
 *   (dx² / rx²) + (dy² / ry²)
 *
 * where:
 *   dx = x - centerX
 *   dy = y - centerY
 *
 * Interpretation:
 *   value < 1  → inside ellipse
 *   value = 1  → on boundary
 *   value > 1  → outside
 *
 * We support:
 * 1. Inside detection → full area clickable
 * 2. Edge detection → small tolerance around boundary
 *
 * This creates consistent interaction with rectangles.
 */
function hitEllipse(shape: Extract<Shape, {type: "circle"}>, x: number, y: number): boolean {
    const dx = x - shape.centerX;
    const dy = y - shape.centerY;

    const rx = shape.radiusX;
    const ry = shape.radiusY;

    // Prevent invalid shapes
    if (rx === 0 || ry === 0) return false;

    const value = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);

    // Inside detection
    if (value <= 1) return true;

    // Edge detection (boundary tolerance)
    return Math.abs(value - 1) < 0.1;
}

/**
 * Line hit detection.
 *
 * A line has no area, so we compute the shortest distance
 * from the point to the line segment.
 *
 * Formula:
 *   distance = |Ax + By + C| / length
 *
 * If distance is within threshold → hit
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
 * Keeps logic modular and avoids large condition chains.
 */
const hitMap: {
    [K in Shape["type"]]: (shape: Extract<Shape, {type: K}>, x: number, y: number) => boolean;
} = {
    rect: hitRect,
    circle: hitEllipse,
    line: hitLine,
};

/**
 * Returns the topmost shape under a given point.
 *
 * Iterates in reverse order because:
 * - shapes drawn later appear on top
 * - so they should be checked first
 *
 * Returns:
 *   Shape if hit
 *   null if no shape is hit
 */
export function getShapeAtPoint(shapes: Shape[], x: number, y: number): Shape | null {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!shape) continue;

        const fn = hitMap[shape.type];

        // Controlled cast due to union type limitations
        if (fn(shape as any, x, y)) {
            return shape;
        }
    }

    return null;
}
