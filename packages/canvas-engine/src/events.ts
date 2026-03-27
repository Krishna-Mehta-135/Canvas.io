/*
Responsibilities of events.ts :-
1. Listen to mouse events
2. Manage interaction state
3. Update CanvasState when needed
4. Call render()
*/

import {render} from "./renderer";
import {PreviewShape, Shape} from "./types";
import {getMousePos} from "./utils";
import {CanvasState} from "./state";
import {getShapeAtPoint} from "./hitDetection";
import {dispatch} from "./store";

type Tool = "rect" | "circle" | "line";

/**
 * Create shape preview during drawing
 */
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

/**
 * Ignore accidental clicks (must drag at least 3px)
 */
function hasDragged(startX: number, startY: number, endX: number, endY: number) {
    const dx = endX - startX;
    const dy = endY - startY;

    return dx * dx + dy * dy > 9; // 3px threshold squared
}

export function attachEvents(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, state: CanvasState) {
    // Drawing state
    let isDrawing = false;
    let startX = 0;
    let startY = 0;

    // Convert PreviewShape → Shape ONLY for rendering
    // This shape is NOT stored in state
    let previewShape: PreviewShape | null = null;

    // Dragging state
    let selectedShape: Shape | null = null;
    let isDragging = false;

    let offsetX = 0;
    let offsetY = 0;

    // For line dragging
    let prevX = 0;
    let prevY = 0;

    // Tool state
    let currentTool: Tool = "circle";
    let activeTool: Tool | null = null;

    // -------------------- MOUSEDOWN --------------------
    canvas.addEventListener("mousedown", (e) => {
        const {x, y} = getMousePos(canvas, e);

        const shape = getShapeAtPoint(state.getShapes(), x, y);

        // DRAGGING MODE
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

            render(ctx, canvas, state.getShapes(), selectedShape);

            return;
        }

        // DRAWING MODE
        activeTool = currentTool;
        isDrawing = true;
        startX = x;
        startY = y;
    });

    // -------------------- MOUSEMOVE --------------------
    canvas.addEventListener("mousemove", (e) => {
        const {x, y} = getMousePos(canvas, e);

        // DRAGGING
        if (isDragging && selectedShape) {
            if (selectedShape.type === "rect") {
                dispatch(state, {
                    type: "MOVE_SHAPE",
                    payload: {
                        id: selectedShape.id,
                        updates: {
                            x: x - offsetX,
                            y: y - offsetY,
                        },
                    },
                });
            } else if (selectedShape.type === "circle") {
                dispatch(state, {
                    type: "MOVE_SHAPE",
                    payload: {
                        id: selectedShape.id,
                        updates: {
                            centerX: x - offsetX,
                            centerY: y - offsetY,
                        },
                    },
                });
            } else if (selectedShape.type === "line") {
                const dx = x - prevX;
                const dy = y - prevY;

                dispatch(state, {
                    type: "MOVE_SHAPE",
                    payload: {
                        id: selectedShape.id,
                        updates: {
                            x1: selectedShape.x1 + dx,
                            y1: selectedShape.y1 + dy,
                            x2: selectedShape.x2 + dx,
                            y2: selectedShape.y2 + dy,
                        },
                    },
                });

                prevX = x;
                prevY = y;
            }

            render(ctx, canvas, state.getShapes(), selectedShape);
            return;
        }

        // DRAWING PREVIEW
        if (!isDrawing || !activeTool) return;

        previewShape = createPreviewShape(activeTool, startX, startY, x, y);

        const shapes = state.getShapes();
        let shapesToRender: Shape[] = shapes;

        if (previewShape) {
            const tempShape: Shape = {
                ...previewShape,
                id: "__preview__", // fake id
            };

            shapesToRender = [...shapes, tempShape];
        }

        render(ctx, canvas, shapesToRender, selectedShape);
    });

    // -------------------- MOUSEUP --------------------
    canvas.addEventListener("mouseup", (e) => {
        const {x, y} = getMousePos(canvas, e);

        // STOP DRAGGING
        if (isDragging) {
            isDragging = false;
            selectedShape = null;
            return;
        }

        // DRAWING COMPLETE
        if (!isDrawing || !activeTool) return;

        if (!hasDragged(startX, startY, x, y)) {
            isDrawing = false;
            activeTool = null;
            previewShape = null;

            render(ctx, canvas, state.getShapes(), selectedShape);
            return;
        }

        const preview = createPreviewShape(activeTool, startX, startY, x, y);

        const finalShape: Shape = {
            ...preview,
            id: crypto.randomUUID(),
        };

        dispatch(state, {
            type: "ADD_SHAPE",
            payload: finalShape,
        });

        isDrawing = false;
        activeTool = null;
        previewShape = null;

        render(ctx, canvas, state.getShapes(), selectedShape);
    });
}
