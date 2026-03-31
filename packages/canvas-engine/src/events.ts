/*
    events.ts

    Handles ALL user interaction.

    Responsibilities:
    - Convert mouse events → actions (dispatch)
    - Manage temporary interaction state
    - Coordinate between interaction helpers + geometry + rendering

    Key Design:
    - Priority: resize > drag > draw
    - No direct mutation (only dispatch)
    - Cursor = visual feedback only (never control flow)
    - Interaction-specific pure helpers live in ./interaction/*
    */

import {render} from "./renderer";
import {Handle, PreviewShape, Shape} from "./types";
import {getMousePos} from "./utils";
import {CanvasState} from "./state";
import {getShapeAtPoint} from "./interaction/hitDetection";
import {dispatch} from "./store";
import {resizeShape} from "./geometry";
import {AttachEventsOptions, isDrawableTool, Tool} from "./interaction/tools";
import {createPreviewShape} from "./interaction/preview";
import {getCursorForHandle} from "./interaction/cursor";
import {getResizeTarget} from "./interaction/resizeTarget";
import {createInlineTextEditor} from "./interaction/textEditor";
import {handleGlobalKeydown} from "./interaction/keyboard";
import {
    getSelectedShapesByIds,
    getSelectionBox,
    hasDragged,
    isShapeInsideBox,
    SelectionBox,
} from "./interaction/selection";

const SELECTION_PADDING = 6;

/* ---------------- EVENTS ---------------- */

/**
 * Wires canvas input events to the engine interaction flow.
 *
 * The host app may either:
 * - provide tool state via options.getTool, or
 * - rely on internal tool state managed by keyboard shortcuts.
 */

export function attachEvents(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    state: CanvasState,
    options: AttachEventsOptions = {}
) {
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
    let isFreehandDrawing = false;
    let freehandPoints: Array<{x: number; y: number}> = [];

    let resizeSession: {
        shape: Shape;
        handle: Handle;
    } | null = null;

    let currentTool: Tool = options.getTool?.() ?? "select";
    let activeTool: Tool | null = null;

    let isSelecting = false;

    let selectionStartX = 0;
    let selectionStartY = 0;

    let selectionBox: SelectionBox | null = null;

    let selectedShapeIds: string[] = [];
    let dragMode: "single" | "multi" | null = null;
    let activeTextEditorCleanup: (() => void) | null = null;

    const getActiveTool = () => options.getTool?.() ?? currentTool;

    const updateTool = (tool: Tool) => {
        currentTool = tool;
        options.onToolChange?.(tool);
    };

    const startTextEditing = (x: number, y: number, existing?: Extract<Shape, {type: "text"}>) => {
        if (activeTextEditorCleanup) {
            activeTextEditorCleanup();
            activeTextEditorCleanup = null;
        }

        const fontSize = existing?.fontSize ?? 24;
        const lineHeight = Math.round(fontSize * 1.25);

        activeTextEditorCleanup = createInlineTextEditor({
            canvas,
            x,
            y,
            ctx,
            initialText: existing?.text ?? "",
            fontSize,
            onInput: (text) => {
                // Live preview: render text on canvas as user types
                render(ctx, canvas, state.getShapes(), null, null, []);
                
                // Draw the live text preview - fully white and visible
                ctx.fillStyle = "#ffffff";
                ctx.font = `${fontSize}px Virgil, Caveat, ui-rounded, sans-serif`;
                ctx.textBaseline = "top";
                const lines = text.split("\n");
                lines.forEach((line, index) => {
                    ctx.fillText(line, x, y + index * lineHeight);
                });
            },
            onCommit: ({text, width, height, fontSize: newFontSize}) => {
                activeTextEditorCleanup = null;

                const trimmed = text.trim();

                if (!trimmed) {
                    if (existing) {
                        dispatch(state, {
                            type: "DELETE_SHAPES",
                            payload: {
                                ids: [existing.id],
                            },
                        });
                        selectedShape = null;
                        selectedShapeIds = [];
                        render(ctx, canvas, state.getShapes(), null, null, []);
                    }
                    return;
                }

                if (existing) {
                    dispatch(state, {
                        type: "MOVE_SHAPE",
                        payload: {
                            id: existing.id,
                            updates: {
                                text: trimmed,
                                width,
                                height,
                                fontSize: newFontSize,
                            },
                        },
                    });

                    selectedShape = state.getShapes().find((shape) => shape.id === existing.id) || existing;
                    selectedShapeIds = [existing.id];
                    render(
                        ctx,
                        canvas,
                        state.getShapes(),
                        selectedShape,
                        null,
                        getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
                    );
                    return;
                }

                const textShape: Extract<Shape, {type: "text"}> = {
                    id: crypto.randomUUID(),
                    type: "text",
                    x,
                    y,
                    text: trimmed,
                    fontSize: newFontSize,
                    width,
                    height,
                };

                dispatch(state, {
                    type: "ADD_SHAPE",
                    payload: textShape,
                });

                selectedShapeIds = [textShape.id];
                selectedShape = state.getShapes().find((shape) => shape.id === textShape.id) || textShape;
                render(
                    ctx,
                    canvas,
                    state.getShapes(),
                    selectedShape,
                    null,
                    getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
                );
            },
            onCancel: () => {
                activeTextEditorCleanup = null;
            },
        });
    };

    /* ---------------- KEYBOARD ---------------- */

    window.addEventListener("keydown", (e) => {
        const keyboardTarget = e.target as HTMLElement | null;
        if (
            keyboardTarget &&
            (keyboardTarget.tagName === "TEXTAREA" || keyboardTarget.tagName === "INPUT" || keyboardTarget.isContentEditable)
        ) {
            return;
        }

        handleGlobalKeydown(e, {
            updateTool,
            hasSelection: () => selectedShapeIds.length > 0,
            deleteSelection: () => {
                dispatch(state, {
                    type: "DELETE_SHAPES",
                    payload: {
                        ids: selectedShapeIds,
                    },
                });

                selectedShapeIds = [];
                selectedShape = null;
                render(ctx, canvas, state.getShapes(), null, null, []);
            },
            nudgeSelection: (dx, dy) => {
                dispatch(state, {
                    type: "NUDGE_SHAPES",
                    payload: {
                        ids: selectedShapeIds,
                        dx,
                        dy,
                    },
                });

                const updatedShapes = state.getShapes();
                selectedShape = updatedShapes.find((shape) => shape.id === selectedShape?.id) || selectedShape;

                render(
                    ctx,
                    canvas,
                    updatedShapes,
                    selectedShape,
                    null,
                    getSelectedShapesByIds(updatedShapes, selectedShapeIds)
                );
            },
            undo: () => {
                state.undo();
                render(ctx, canvas, state.getShapes(), null);
            },
            redo: () => {
                state.redo();
                render(ctx, canvas, state.getShapes(), null);
            },
        });
    });

    /* ---------------- MOUSEDOWN ---------------- */

    canvas.addEventListener("mousedown", (e) => {
        const {x, y} = getMousePos(canvas, e);
        const shapes = state.getShapes();

        const resizeTarget = getResizeTarget(shapes, x, y, selectedShape, SELECTION_PADDING);

        // RESIZE
        if (resizeTarget) {
            isResizing = true;
            resizeSession = resizeTarget;
            selectedShape = resizeTarget.shape;
            selectedShapeIds = [resizeTarget.shape.id];
            return;
        }

        const shape = getShapeAtPoint(shapes, x, y);

        if (shape && getActiveTool() === "select" && e.shiftKey) {
            const exists = selectedShapeIds.includes(shape.id);

            if (exists) {
                selectedShapeIds = selectedShapeIds.filter((id) => id !== shape.id);
            } else {
                selectedShapeIds = [...selectedShapeIds, shape.id];
            }

            const selectedShapes = getSelectedShapesByIds(shapes, selectedShapeIds);
            selectedShape = selectedShapes[selectedShapes.length - 1] || null;

            render(ctx, canvas, shapes, selectedShape, null, selectedShapes);
            return;
        }

        if (shape && getActiveTool() === "text" && shape.type === "text") {
            e.stopPropagation();
            e.preventDefault();
            startTextEditing(shape.x, shape.y, shape);
            return;
        }

        if (!shape && getActiveTool() === "text") {
            e.stopPropagation();
            e.preventDefault();
            startTextEditing(x, y);
            return;
        }

        if (!shape && getActiveTool() === "freehand") {
            isFreehandDrawing = true;
            freehandPoints = [{x, y}];
            return;
        }

        // ---------------- DRAG ----------------
        if (shape) {
            selectedShape = shape;
            isDragging = true;

            const isShapeInSelection = selectedShapeIds.includes(shape.id);
            if (isShapeInSelection && selectedShapeIds.length > 1) {
                dragMode = "multi";
                prevX = x;
                prevY = y;

                render(ctx, canvas, state.getShapes(), shape, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds));
                return;
            }

            selectedShapeIds = [shape.id];
            dragMode = "single";

            if (shape.type === "rect") {
                offsetX = x - shape.x;
                offsetY = y - shape.y;
            } else if (shape.type === "circle") {
                offsetX = x - shape.centerX;
                offsetY = y - shape.centerY;
            } else if (shape.type === "line") {
                prevX = x;
                prevY = y;
            } else if (shape.type === "text") {
                offsetX = x - shape.x;
                offsetY = y - shape.y;
            } else if (shape.type === "freehand") {
                prevX = x;
                prevY = y;
            }

            render(ctx, canvas, state.getShapes(), shape, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds));
            return;
        }

        // EMPTY CLICK
        if (!shape && getActiveTool() === "select") {
            isSelecting = true;

            selectionStartX = x;
            selectionStartY = y;

            selectedShapeIds = [];
            selectedShape = null;

            render(ctx, canvas, state.getShapes(), null, null, []);
            return;
        }

        // DRAW
        const active = getActiveTool();
        if (!isDrawableTool(active)) {
            return;
        }

        activeTool = active;
        isDrawing = true;
        startX = x;
        startY = y;
    });

    /* ---------------- MOUSEMOVE ---------------- */

    canvas.addEventListener("mousemove", (e) => {
        const {x, y} = getMousePos(canvas, e);

        const shapes = state.getShapes();
        const resizeTarget = getResizeTarget(shapes, x, y, selectedShape, SELECTION_PADDING);
        const shape = getShapeAtPoint(shapes, x, y);

        // CURSOR
        if (resizeTarget) {
            canvas.style.cursor = getCursorForHandle(resizeTarget.handle);
        } else if (shape) {
            canvas.style.cursor = "move";
        } else if (getActiveTool() === "select") {
            canvas.style.cursor = "default";
        } else if (getActiveTool() === "text") {
            canvas.style.cursor = "text";
        } else {
            canvas.style.cursor = "crosshair";
        }

        // RESIZE
        if (isResizing && resizeSession) {
            const {shape, handle} = resizeSession;

            const updates = resizeShape(shape, handle, x, y, {
                fromCenter: e.altKey,
                preserveAspect: e.shiftKey,
            });

            dispatch(state, {
                type: "MOVE_SHAPE",
                payload: {
                    id: shape.id,
                    updates,
                },
            });

            const updated = state.getShapes().find((s) => s.id === shape.id);
            render(
                ctx,
                canvas,
                state.getShapes(),
                updated || null,
                null,
                getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
            );
            return;
        }

        // DRAG
        if (isDragging && selectedShape) {
            if (dragMode === "multi") {
                const dx = x - prevX;
                const dy = y - prevY;

                if (dx !== 0 || dy !== 0) {
                    dispatch(state, {
                        type: "MOVE_SHAPES",
                        payload: {
                            ids: selectedShapeIds,
                            dx,
                            dy,
                        },
                    });
                }

                prevX = x;
                prevY = y;

                const updatedShapes = state.getShapes();
                const updatedSelectedShapes = getSelectedShapesByIds(updatedShapes, selectedShapeIds);
                selectedShape = updatedShapes.find((shape) => shape.id === selectedShape?.id) || selectedShape;

                render(ctx, canvas, updatedShapes, selectedShape, null, updatedSelectedShapes);
                return;
            }

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
            } else if (selected.type === "text") {
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
            } else if (selected.type === "freehand") {
                const current = state.getShapes().find((s) => s.id === selected.id);
                if (!current || current.type !== "freehand") return;

                const dx = x - prevX;
                const dy = y - prevY;

                dispatch(state, {
                    type: "MOVE_SHAPE",
                    payload: {
                        id: selected.id,
                        updates: {
                            points: current.points.map((point) => ({
                                x: point.x + dx,
                                y: point.y + dy,
                            })),
                        },
                    },
                });

                prevX = x;
                prevY = y;
            }

            render(
                ctx,
                canvas,
                state.getShapes(),
                selected,
                null,
                getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
            );
            return;
        }

        // ---------------- SELECTION BOX ----------------
        if (isSelecting) {
            const currentSelectionBox = getSelectionBox(selectionStartX, selectionStartY, x, y);
            selectionBox = currentSelectionBox;

            const selectedShapes = shapes.filter((s) => isShapeInsideBox(s, currentSelectionBox));
            selectedShapeIds = selectedShapes.map((shape) => shape.id);

            render(ctx, canvas, shapes, null, selectionBox, selectedShapes);
            return;
        }

        if (isFreehandDrawing) {
            freehandPoints = [...freehandPoints, {x, y}];

            const preview: PreviewShape = {
                type: "freehand",
                points: freehandPoints,
            };

            render(ctx, canvas, [...shapes, {...preview, id: "__preview__"}], selectedShape, null, getSelectedShapesByIds(shapes, selectedShapeIds));
            return;
        }

        // DRAW PREVIEW
        if (!isDrawing || !activeTool) return;

        previewShape = createPreviewShape(activeTool, startX, startY, x, y, {
            preserveAspect: e.shiftKey,
        });

        let shapesToRender = shapes;

        if (previewShape) {
            shapesToRender = [...shapes, {...previewShape, id: "__preview__"}];
        }

        render(
            ctx,
            canvas,
            shapesToRender,
            selectedShape,
            null,
            getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
        );
    });

    /* ---------------- MOUSEUP ---------------- */

    canvas.addEventListener("mouseup", (e) => {
        const {x, y} = getMousePos(canvas, e);

        if (isFreehandDrawing) {
            isFreehandDrawing = false;

            if (freehandPoints.length > 1) {
                const freehandShape: Extract<Shape, {type: "freehand"}> = {
                    id: crypto.randomUUID(),
                    type: "freehand",
                    points: freehandPoints,
                };

                dispatch(state, {
                    type: "ADD_SHAPE",
                    payload: freehandShape,
                });

                selectedShape = state.getShapes().find((shape) => shape.id === freehandShape.id) || freehandShape;
                selectedShapeIds = [freehandShape.id];
            }

            freehandPoints = [];
            render(
                ctx,
                canvas,
                state.getShapes(),
                selectedShape,
                null,
                getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
            );
            return;
        }

        if (isSelecting) {
            const didDragSelection = hasDragged(selectionStartX, selectionStartY, x, y);
            isSelecting = false;
            selectionBox = null;

            // pick primary shape (top-most inside selection)
            const selectedShapes = getSelectedShapesByIds(state.getShapes(), selectedShapeIds);
            selectedShape = didDragSelection ? selectedShapes[selectedShapes.length - 1] || null : null;
            if (!didDragSelection) {
                selectedShapeIds = [];
            }

            render(
                ctx,
                canvas,
                state.getShapes(),
                selectedShape,
                null,
                getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
            );
            return;
        }

        if (isResizing) {
            isResizing = false;
            resizeSession = null;
            return;
        }

        if (isDragging) {
            isDragging = false;
            dragMode = null;
            return;
        }

        if (!isDrawing || !activeTool) return;

        if (!hasDragged(startX, startY, x, y)) {
            isDrawing = false;
            activeTool = null;
            previewShape = null;
            render(
                ctx,
                canvas,
                state.getShapes(),
                selectedShape,
                null,
                getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
            );
            return;
        }

        const preview = createPreviewShape(activeTool, startX, startY, x, y, {
            preserveAspect: e.shiftKey,
        });

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

        render(
            ctx,
            canvas,
            state.getShapes(),
            selectedShape,
            null,
            getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
        );
    });

    canvas.addEventListener("dblclick", (e) => {
        const {x, y} = getMousePos(canvas, e);
        const shape = getShapeAtPoint(state.getShapes(), x, y);
        if (!shape || shape.type !== "text") return;

        startTextEditing(shape.x, shape.y, shape);
    });
}
