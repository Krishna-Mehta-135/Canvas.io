import {getHandleAtPoint} from "../hitDetection";
import {Handle, Shape} from "../types";

/**
 * Resolves the handle/shape pair for resize interactions.
 * Priority order:
 * 1) currently selected shape
 * 2) top-most shape under pointer
 */
export function getResizeTarget(
    shapes: Shape[],
    x: number,
    y: number,
    selectedShape: Shape | null,
    padding: number
): {shape: Shape; handle: Handle} | null {
    if (selectedShape) {
        const selected = shapes.find((s) => s.id === selectedShape.id);

        if (selected) {
            const selectedHandle = getHandleAtPoint(selected, x, y, padding);
            if (selectedHandle) {
                return {shape: selected, handle: selectedHandle};
            }
        }
    }

    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!shape) continue;

        const handle = getHandleAtPoint(shape, x, y, padding);
        if (handle) {
            return {shape, handle};
        }
    }

    return null;
}
