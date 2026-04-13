/*
utils.ts

Small shared helpers used by interaction and rendering layers.
*/

export type Viewport = {
    x: number;
    y: number;
    scale: number;
};

export function screenToWorldPoint(point: {x: number; y: number}, viewport: Viewport) {
    return {
        x: (point.x - viewport.x) / viewport.scale,
        y: (point.y - viewport.y) / viewport.scale,
    };
}

export function worldToScreenPoint(point: {x: number; y: number}, viewport: Viewport) {
    return {
        x: point.x * viewport.scale + viewport.x,
        y: point.y * viewport.scale + viewport.y,
    };
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function getMousePos(canvas: HTMLCanvasElement, e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}
