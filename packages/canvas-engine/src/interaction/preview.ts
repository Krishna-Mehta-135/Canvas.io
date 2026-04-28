import { PreviewShape } from "../types";
import { Tool } from "./tools";

type PreviewOptions = {
  preserveAspect?: boolean;
};

/**
 * Builds an in-progress shape from drag start and current pointer position.
 * The returned shape is not committed to state and is used only for preview rendering.
 */
export function createPreviewShape(
  tool: Tool,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  options: PreviewOptions = {},
): PreviewShape | null {
  const { preserveAspect = false } = options;

  if (tool === "rect") {
    let nextX = currentX;
    let nextY = currentY;

    if (preserveAspect) {
      const dx = currentX - startX;
      const dy = currentY - startY;
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      nextX = startX + Math.sign(dx || 1) * size;
      nextY = startY + Math.sign(dy || 1) * size;
    }

    return {
      type: "rect",
      x: Math.min(startX, nextX),
      y: Math.min(startY, nextY),
      width: Math.abs(nextX - startX),
      height: Math.abs(nextY - startY),
    };
  }

  if (tool === "circle") {
    let nextX = currentX;
    let nextY = currentY;

    if (preserveAspect) {
      const dx = currentX - startX;
      const dy = currentY - startY;
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      nextX = startX + Math.sign(dx || 1) * size;
      nextY = startY + Math.sign(dy || 1) * size;
    }

    const x = Math.min(startX, nextX);
    const y = Math.min(startY, nextY);

    const width = Math.abs(nextX - startX);
    const height = Math.abs(nextY - startY);

    return {
      type: "circle",
      centerX: x + width / 2,
      centerY: y + height / 2,
      radiusX: width / 2,
      radiusY: height / 2,
    };
  }

  if (tool === "rhombus") {
    let nextX = currentX;
    let nextY = currentY;

    if (preserveAspect) {
      const dx = currentX - startX;
      const dy = currentY - startY;
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      nextX = startX + Math.sign(dx || 1) * size;
      nextY = startY + Math.sign(dy || 1) * size;
    }

    return {
      type: "rhombus",
      x: Math.min(startX, nextX),
      y: Math.min(startY, nextY),
      width: Math.abs(nextX - startX),
      height: Math.abs(nextY - startY),
    };
  }

  if (tool === "line" || tool === "arrow") {
    if (preserveAspect) {
      const dx = currentX - startX;
      const dy = currentY - startY;
      const angle = Math.atan2(dy, dx);
      const step = Math.PI / 4;
      const snappedAngle = Math.round(angle / step) * step;
      const distance = Math.hypot(dx, dy);

      return {
        type: tool,
        x1: startX,
        y1: startY,
        x2: startX + Math.cos(snappedAngle) * distance,
        y2: startY + Math.sin(snappedAngle) * distance,
      };
    }

    return {
      type: tool,
      x1: startX,
      y1: startY,
      x2: currentX,
      y2: currentY,
    };
  }

  return null;
}
