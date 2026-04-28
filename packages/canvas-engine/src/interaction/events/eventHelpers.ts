import { Viewport, worldToScreenPoint } from "../../utils";

export const SELECTION_PADDING = 6;
export const MIN_ZOOM = 0.12;
export const MAX_ZOOM = 4;
export const WHEEL_ZOOM_SENSITIVITY = 0.0035;
export const WHEEL_PAN_SENSITIVITY = 1;
export const DEFAULT_SHAPE_ROUGHNESS = 1.8;

function getPixelRatio() {
  return window.devicePixelRatio || 1;
}

export function resizeCanvasForViewport(canvas: HTMLCanvasElement) {
  const pixelRatio = getPixelRatio();
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  return { width, height, pixelRatio };
}

export function getScenePixelRatio() {
  return window.devicePixelRatio || 1;
}

export function getPreviewTextColor() {
  if (typeof document === "undefined") return "#f8fafc";

  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "light" ? "#1f2937" : "#f8fafc";
}

export function drawEraserTrail(
  drawingCtx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  currentViewport: Viewport,
  pixelRatio: number,
) {
  if (points.length === 0) return;

  const screenPoints = points.map((point) =>
    worldToScreenPoint(point, currentViewport),
  );

  drawingCtx.save();
  drawingCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawingCtx.strokeStyle = "rgba(148, 163, 184, 0.85)";
  drawingCtx.fillStyle = "rgba(148, 163, 184, 0.9)";
  drawingCtx.lineWidth = 7;
  drawingCtx.lineCap = "round";
  drawingCtx.lineJoin = "round";

  if (screenPoints.length === 1) {
    drawingCtx.beginPath();
    drawingCtx.arc(screenPoints[0]!.x, screenPoints[0]!.y, 3.5, 0, Math.PI * 2);
    drawingCtx.fill();
    drawingCtx.restore();
    return;
  }

  drawingCtx.beginPath();
  drawingCtx.moveTo(screenPoints[0]!.x, screenPoints[0]!.y);

  for (let i = 1; i < screenPoints.length; i++) {
    const prev = screenPoints[i - 1]!;
    const current = screenPoints[i]!;
    const midX = (prev.x + current.x) / 2;
    const midY = (prev.y + current.y) / 2;
    drawingCtx.quadraticCurveTo(prev.x, prev.y, midX, midY);
  }

  const lastPoint = screenPoints[screenPoints.length - 1]!;
  drawingCtx.lineTo(lastPoint.x, lastPoint.y);
  drawingCtx.stroke();

  drawingCtx.beginPath();
  drawingCtx.arc(lastPoint.x, lastPoint.y, 3.5, 0, Math.PI * 2);
  drawingCtx.fill();
  drawingCtx.restore();
}
