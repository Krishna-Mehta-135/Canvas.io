import {Shape} from "../types";
import {convertToPoints} from "../geometry";

/**
 * Axis-aligned marquee selection bounds in canvas space.
 */
export type SelectionBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export function hasDragged(startX: number, startY: number, endX: number, endY: number) {
    const dx = endX - startX;
    const dy = endY - startY;
    return dx * dx + dy * dy > 9;
}

/**
 * Converts two arbitrary drag points into a normalized box.
 */
export function getSelectionBox(x1: number, y1: number, x2: number, y2: number): SelectionBox {
    return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
    };
}

/**
 * Returns true when the entire shape is fully contained in the selection box.
 */
export function isShapeInsideBox(shape: Shape, box: SelectionBox) {
    const {x, y, width, height} = box;

    const x2 = x + width;
    const y2 = y + height;

    if (shape.type !== "freehand") {
        const bounds = convertToPoints(shape);
        return bounds.x1 >= x && bounds.x2 <= x2 && bounds.y1 >= y && bounds.y2 <= y2;
    }

    if (shape.type === "freehand") {
        if (shape.points.length === 0) return false;

        return shape.points.every((point) => point.x >= x && point.x <= x2 && point.y >= y && point.y <= y2);
    }
}

/**
 * Materializes selected ids to actual shape objects while preserving canvas order.
 */
export function getSelectedShapesByIds(shapes: Shape[], selectedIds: string[]) {
    const selectedIdSet = new Set(selectedIds);
    return shapes.filter((shape) => selectedIdSet.has(shape.id));
}
