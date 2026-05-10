import type { Shape } from "./types";

export type ConnectorPoint = {
  x: number;
  y: number;
};

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

export function getConnectorRoutePoints(
  shapeOrPoints:
    | Extract<Shape, { type: "line" | "arrow" }>
    | {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      },
): ConnectorPoint[] {
  const x1 = finiteOr(shapeOrPoints.x1, 0);
  const y1 = finiteOr(shapeOrPoints.y1, 0);
  const x2 = finiteOr(shapeOrPoints.x2, 0);
  const y2 = finiteOr(shapeOrPoints.y2, 0);

  if (x1 === x2 || y1 === y2) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = x1 + dx / 2;
    return [
      { x: x1, y: y1 },
      { x: midX, y: y1 },
      { x: midX, y: y2 },
      { x: x2, y: y2 },
    ];
  }

  const midY = y1 + dy / 2;
  return [
    { x: x1, y: y1 },
    { x: x1, y: midY },
    { x: x2, y: midY },
    { x: x2, y: y2 },
  ];
}

export function getArrowHeadPoints(
  shapeOrPoints:
    | Extract<Shape, { type: "arrow" }>
    | {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      },
) {
  const points = getConnectorRoutePoints(shapeOrPoints);
  const tip = points[points.length - 1];
  const previousPoint = points[points.length - 2];

  if (!tip || !previousPoint) {
    return null;
  }

  const dx = tip.x - previousPoint.x;
  const dy = tip.y - previousPoint.y;
  const length = Math.hypot(dx, dy);

  if (length <= 0.001) {
    return null;
  }

  const ux = dx / length;
  const uy = dy / length;
  const headLength = Math.min(18, Math.max(10, length * 0.25));
  const spread = Math.PI / 7;
  const cos = Math.cos(spread);
  const sin = Math.sin(spread);

  return {
    tip,
    left: {
      x: tip.x - (ux * cos - uy * sin) * headLength,
      y: tip.y - (uy * cos + ux * sin) * headLength,
    },
    right: {
      x: tip.x - (ux * cos + uy * sin) * headLength,
      y: tip.y - (uy * cos - ux * sin) * headLength,
    },
  };
}
