import {PreviewShape} from "../types";
import {Tool} from "./tools";

/**
 * Builds an in-progress shape from drag start and current pointer position.
 * The returned shape is not committed to state and is used only for preview rendering.
 */
export function createPreviewShape(
    tool: Tool,
    startX: number,
    startY: number,
    currentX: number,
    currentY: number
): PreviewShape {
    if (tool === "rect") {
        return {
            type: "rect",
            x: Math.min(startX, currentX),
            y: Math.min(startY, currentY),
            width: Math.abs(currentX - startX),
            height: Math.abs(currentY - startY),
        };
    }

    if (tool === "circle") {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        return {
            type: "circle",
            centerX: x + width / 2,
            centerY: y + height / 2,
            radiusX: width / 2,
            radiusY: height / 2,
        };
    }

    if (tool === "line") {
        return {
            type: "line",
            x1: startX,
            y1: startY,
            x2: currentX,
            y2: currentY,
        };
    }

    throw new Error("Unknown tool");
}
