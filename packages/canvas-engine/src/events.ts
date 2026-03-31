/*
    events.ts

    Handles ALL user interaction.

    Responsibilities:
    - Convert mouse events → actions (dispatch)
    - Manage temporary interaction state
    - Coordinate between detection + geometry + rendering

    Key Design:
    - Priority: resize > drag > draw
    - No direct mutation (only dispatch)
    - Cursor = visual feedback only (never control flow)
    */

import {render} from "./renderer";
import {Handle, PreviewShape, Shape} from "./types";
import {getMousePos} from "./utils";
import {CanvasState} from "./state";
import {getShapeAtPoint, getHandleAtPoint} from "./hitDetection";
import {dispatch} from "./store";
import {resizeShape} from "./geometry";

type Tool = "rect" | "circle" | "line";
const SELECTION_PADDING = 6;

function getResizeTarget(shapes: Shape[], x: number, y: number, selectedShape: Shape | null) {
    if (selectedShape) {
        const selected = shapes.find((s) => s.id === selectedShape.id);

        if (selected) {
            const selectedHandle = getHandleAtPoint(selected, x, y, SELECTION_PADDING);
            if (selectedHandle) {
                return {shape: selected, handle: selectedHandle};
            }
        }
    }

    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!shape) continue;

        const handle = getHandleAtPoint(shape, x, y, SELECTION_PADDING);
        if (handle) {
            return {shape, handle};
        }
    }

    return null;
}

/* ---------------- PREVIEW ---------------- */

function createPreviewShape(
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

function hasDragged(startX: number, startY: number, endX: number, endY: number) {
    const dx = endX - startX;
    const dy = endY - startY;
    return dx * dx + dy * dy > 9;
}

/* ---------------- EVENTS ---------------- */

export function attachEvents(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, state: CanvasState) {
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let previewShape: PreviewShape | null = null;

    let selectedShape: Shape | null = null;
    let isDragging = false;

    let offsetX = 0;
    let offsetY = 0;

    let prevX = 0;
    let prevY = 0;

    let isResizing = false;

    let resizeSession: {
        shape: Shape;
        handle: Handle;
    } | null = null;

    let currentTool: Tool = "rect";
    let activeTool: Tool | null = null;

    /* ---------------- KEYBOARD ---------------- */

    window.addEventListener("keydown", (e) => {
        if (e.key === "1") currentTool = "rect";
        if (e.key === "2") currentTool = "circle";
        if (e.key === "3") currentTool = "line";

        //Undo func
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
            e.preventDefault();
            state.undo();
            render(ctx, canvas, state.getShapes(), null);
        }

        //Redo func
        if ((e.ctrlKey || e.metaKey) && e.key === "y") {
            e.preventDefault();
            state.redo();
            render(ctx, canvas, state.getShapes(), null);
        }
    });

    /* ---------------- MOUSEDOWN ---------------- */

    canvas.addEventListener("mousedown", (e) => {
        const {x, y} = getMousePos(canvas, e);
        const shapes = state.getShapes();

        const resizeTarget = getResizeTarget(shapes, x, y, selectedShape);

        // RESIZE
        if (resizeTarget) {
            isResizing = true;
            resizeSession = resizeTarget;
            selectedShape = resizeTarget.shape;
            return;
        }

        const shape = getShapeAtPoint(shapes, x, y);

        // ---------------- DRAG ----------------
        if (shape) {
            selectedShape = shape;
            isDragging = true;

            if (shape.type === "rect") {
                offsetX = x - shape.x;
                offsetY = y - shape.y;
            } else if (shape.type === "circle") {
                offsetX = x - shape.centerX;
                offsetY = y - shape.centerY;
            } else if (shape.type === "line") {
                prevX = x;
                prevY = y;
            }

            render(ctx, canvas, state.getShapes(), shape);
            return;
        }

        // DRAW
        activeTool = currentTool;
        isDrawing = true;
        startX = x;
        startY = y;
    });

    /* ---------------- MOUSEMOVE ---------------- */

    canvas.addEventListener("mousemove", (e) => {
        const {x, y} = getMousePos(canvas, e);

        const shapes = state.getShapes();
        const resizeTarget = getResizeTarget(shapes, x, y, selectedShape);
        const shape = getShapeAtPoint(shapes, x, y);

        // CURSOR
        if (resizeTarget) {
            canvas.style.cursor = getCursorForHandle(resizeTarget.handle);
        } else if (shape) {
            canvas.style.cursor = "move";
        } else {
            canvas.style.cursor = "crosshair";
        }

        // RESIZE
        if (isResizing && resizeSession) {
            const {shape, handle} = resizeSession;

            const updates = resizeShape(shape, handle, x, y);

            dispatch(state, {
                type: "MOVE_SHAPE",
                payload: {
                    id: shape.id,
                    updates,
                },
            });

            const updated = state.getShapes().find((s) => s.id === shape.id);
            render(ctx, canvas, state.getShapes(), updated || null);
            return;
        }

        // DRAG
        if (isDragging && selectedShape) {
            const selected = selectedShape;

            if (selected.type === "rect") {
                dispatch(state, {
                    type: "MOVE_SHAPE",
                    payload: {
                        id: selected.id,
                        updates: {
                            x: x - offsetX,
                            y: y - offsetY,
                        },
                    },
                });
            } else if (selected.type === "circle") {
                dispatch(state, {
                    type: "MOVE_SHAPE",
                    payload: {
                        id: selected.id,
                        updates: {
                            centerX: x - offsetX,
                            centerY: y - offsetY,
                        },
                    },
                });
            } else if (selected.type === "line") {
                const current = state.getShapes().find((s) => s.id === selected.id);
                if (!current || current.type !== "line") return;

                const dx = x - prevX;
                const dy = y - prevY;

                dispatch(state, {
                    type: "MOVE_SHAPE",
                    payload: {
                        id: current.id,
                        updates: {
                            x1: current.x1 + dx,
                            y1: current.y1 + dy,
                            x2: current.x2 + dx,
                            y2: current.y2 + dy,
                        },
                    },
                });

                prevX = x;
                prevY = y;
            }

            render(ctx, canvas, state.getShapes(), selected);
            return;
        }

        // DRAW PREVIEW
        if (!isDrawing || !activeTool) return;

        previewShape = createPreviewShape(activeTool, startX, startY, x, y);

        let shapesToRender = shapes;

        if (previewShape) {
            shapesToRender = [...shapes, {...previewShape, id: "__preview__"}];
        }

        render(ctx, canvas, shapesToRender, selectedShape);
    });

    /* ---------------- MOUSEUP ---------------- */

    canvas.addEventListener("mouseup", (e) => {
        const {x, y} = getMousePos(canvas, e);

        if (isResizing) {
            isResizing = false;
            resizeSession = null;
            return;
        }

        if (isDragging) {
            isDragging = false;
            selectedShape = null;
            return;
        }

        if (!isDrawing || !activeTool) return;

        if (!hasDragged(startX, startY, x, y)) {
            isDrawing = false;
            activeTool = null;
            previewShape = null;
            render(ctx, canvas, state.getShapes(), null);
            return;
        }

        const preview = createPreviewShape(activeTool, startX, startY, x, y);

        dispatch(state, {
            type: "ADD_SHAPE",
            payload: {
                ...preview,
                id: crypto.randomUUID(),
            },
        });

        isDrawing = false;
        activeTool = null;
        previewShape = null;

        render(ctx, canvas, state.getShapes(), null);
    });
}

/* ---------------- CURSOR ---------------- */

function getCursorForHandle(handle: Handle) {
    switch (handle) {
        case "top-left":
        case "bottom-right":
            return "nwse-resize";
        case "top-right":
        case "bottom-left":
            return "nesw-resize";
        case "left":
        case "right":
            return "ew-resize";
        case "top":
        case "bottom":
            return "ns-resize";
        case "start":
        case "end":
            return "pointer";
    }
}
