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
import {convertToPoints, resizeShape} from "./geometry";
import {AttachEventsController, AttachEventsOptions, isDrawableTool, Tool} from "./interaction/tools";
import {createPreviewShape} from "./interaction/preview";
import {getCursorForHandle} from "./interaction/cursor";
import {getResizeTarget} from "./interaction/resizeTarget";
import {createInlineTextEditor} from "./interaction/textEditor";
import {handleGlobalKeydown} from "./interaction/keyboard";
import {getWrappedTextLines} from "./textLayout";
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
): AttachEventsController {
    render(ctx, canvas, state.getShapes(), null, null, []);

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

    const resetToSelectTool = () => {
        if (getActiveTool() === "select") return;
        updateTool("select");
    };

    const emitSelectionChange = () => {
        options.onSelectionChange?.([...selectedShapeIds]);
    };

    const setSelection = (ids: string[], primaryId?: string | null) => {
        selectedShapeIds = [...ids];

        const shapes = state.getShapes();
        const selectedShapes = getSelectedShapesByIds(shapes, selectedShapeIds);

        if (primaryId) {
            selectedShape = selectedShapes.find((shape) => shape.id === primaryId) || selectedShapes[selectedShapes.length - 1] || null;
        } else {
            selectedShape = selectedShapes[selectedShapes.length - 1] || null;
        }

        emitSelectionChange();
        return selectedShapes;
    };

    const clearSelection = () => {
        selectedShapeIds = [];
        selectedShape = null;
        emitSelectionChange();
    };

    const getSelectionBounds = (ids: string[]) => {
        if (ids.length === 0) return null;

        const selectedShapes = getSelectedShapesByIds(state.getShapes(), ids);
        if (selectedShapes.length === 0) return null;

        const first = convertToPoints(selectedShapes[0]!);
        let minX = first.x1;
        let minY = first.y1;
        let maxX = first.x2;
        let maxY = first.y2;

        for (let i = 1; i < selectedShapes.length; i++) {
            const shape = selectedShapes[i];
            if (!shape) continue;
            const box = convertToPoints(shape);
            minX = Math.min(minX, box.x1);
            minY = Math.min(minY, box.y1);
            maxX = Math.max(maxX, box.x2);
            maxY = Math.max(maxY, box.y2);
        }

        // Expanded by selection padding so hit area matches visible selection outline.
        return {
            x1: minX - SELECTION_PADDING,
            y1: minY - SELECTION_PADDING,
            x2: maxX + SELECTION_PADDING,
            y2: maxY + SELECTION_PADDING,
        };
    };

    const deleteSelection = () => {
        if (selectedShapeIds.length === 0) return;

        dispatch(state, {
            type: "DELETE_SHAPES",
            payload: {
                ids: selectedShapeIds,
            },
        });

        clearSelection();
        render(ctx, canvas, state.getShapes(), null, null, []);
    };

    const startTextEditing = (
        x: number,
        y: number,
        existing?: Extract<Shape, {type: "text"}>,
        parentShape?: Exclude<Shape, Extract<Shape, {type: "text"}>>
    ) => {
        if (activeTextEditorCleanup) {
            activeTextEditorCleanup();
            activeTextEditorCleanup = null;
        }

        const fontSize = existing?.fontSize ?? 24;
        const lineHeight = Math.round(fontSize * 1.25);

        // Parent box constrains initial text width/height when text is bound to a parent shape.
        const parentBox = parentShape ? convertToPoints(parentShape) : null;
        const parentPadding = 8;
        const maxPreviewWidth = parentBox ? Math.max(8, parentBox.x2 - x - parentPadding) : Number.MAX_SAFE_INTEGER;

        activeTextEditorCleanup = createInlineTextEditor({
            canvas,
            x,
            y,
            ctx,
            initialText: existing?.text ?? "",
            fontSize,
            onInput: (text) => {
                // Live preview: render text on canvas as user types.
                // While editing an existing text shape, hide that old shape to avoid doubled text.
                const previewShapes = existing
                    ? state.getShapes().filter((shape) => shape.id !== existing.id)
                    : state.getShapes();

                render(ctx, canvas, previewShapes, null, null, []);
                
                // Draw the live text preview - fully white and visible
                ctx.fillStyle = "#ffffff";
                ctx.font = `${fontSize}px Virgil, Caveat, ui-rounded, sans-serif`;
                ctx.textBaseline = "top";
                                const previewWidth = existing ? existing.width : maxPreviewWidth;
                                const previewHeight = existing
                                        ? existing.height
                                        : parentBox
                                            ? Math.max(8, parentBox.y2 - y - parentPadding)
                                            : Number.MAX_SAFE_INTEGER;
                // Use the same wrapping helper as final renderer so preview matches committed output.
                const wrappedLines = getWrappedTextLines(ctx, text, previewWidth);
                const maxY = y + previewHeight;

                wrappedLines.forEach((line, index) => {
                    const drawY = y + index * lineHeight;
                    if (drawY + lineHeight > maxY) return;
                    ctx.fillText(line, x, drawY);
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
                        clearSelection();
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

                    setSelection([existing.id], existing.id);
                    render(
                        ctx,
                        canvas,
                        state.getShapes(),
                        selectedShape,
                        null,
                        getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
                    );
                    resetToSelectTool();
                    return;
                }

                const textShape: Extract<Shape, {type: "text"}> = {
                    id: crypto.randomUUID(),
                    type: "text",
                    x,
                    y,
                    text: trimmed,
                    fontSize: newFontSize,
                    width: Math.max(8, Math.min(width, maxPreviewWidth)),
                    height,
                    parentId: parentShape?.id,
                };

                ctx.save();
                ctx.font = `${newFontSize}px Virgil, Caveat, ui-rounded, sans-serif`;
                const wrappedLines = getWrappedTextLines(ctx, trimmed, textShape.width);
                ctx.restore();
                const wrappedLineHeight = newFontSize * 1.25;
                const contentHeight = Math.max(wrappedLineHeight, wrappedLines.length * wrappedLineHeight);
                textShape.height = parentBox
                    ? Math.min(contentHeight, Math.max(8, parentBox.y2 - y - parentPadding))
                    : contentHeight;

                dispatch(state, {
                    type: "ADD_SHAPE",
                    payload: textShape,
                });

                setSelection([textShape.id], textShape.id);
                render(
                    ctx,
                    canvas,
                    state.getShapes(),
                    selectedShape,
                    null,
                    getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
                );
                resetToSelectTool();
            },
            onCancel: () => {
                activeTextEditorCleanup = null;
                render(
                    ctx,
                    canvas,
                    state.getShapes(),
                    selectedShape,
                    null,
                    getSelectedShapesByIds(state.getShapes(), selectedShapeIds)
                );
                resetToSelectTool();
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
            deleteSelection,
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
                clearSelection();
                render(ctx, canvas, state.getShapes(), null);
            },
            redo: () => {
                state.redo();
                clearSelection();
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
            setSelection([resizeTarget.shape.id], resizeTarget.shape.id);
            return;
        }

        const shape = getShapeAtPoint(shapes, x, y);

        // Allow dragging multi-selection from empty space inside the selection bounds.
        if (!shape && getActiveTool() === "select" && selectedShapeIds.length > 1) {
            const bounds = getSelectionBounds(selectedShapeIds);
            const isInsideBounds =
                !!bounds && x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;

            if (isInsideBounds) {
                isDragging = true;
                dragMode = "multi";
                prevX = x;
                prevY = y;

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
        }

        if (shape && getActiveTool() === "select" && e.shiftKey) {
            const exists = selectedShapeIds.includes(shape.id);
            let nextSelectionIds = selectedShapeIds;

            if (exists) {
                nextSelectionIds = selectedShapeIds.filter((id) => id !== shape.id);
            } else {
                nextSelectionIds = [...selectedShapeIds, shape.id];
            }

            const selectedShapes = setSelection(nextSelectionIds);

            render(ctx, canvas, shapes, selectedShape, null, selectedShapes);
            return;
        }

        // TEXT TOOL: click anywhere to place text, including on top of other shapes.
        // Existing text shape click enters edit mode for that shape.
        if (getActiveTool() === "text") {
            e.stopPropagation();
            e.preventDefault();

            if (shape?.type === "text") {
                startTextEditing(shape.x, shape.y, shape);
            } else {
                startTextEditing(x, y, undefined, shape || undefined);
            }

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

            setSelection([shape.id], shape.id);
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

            clearSelection();

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
            emitSelectionChange();

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

                setSelection([freehandShape.id], freehandShape.id);
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
            resetToSelectTool();
            return;
        }

        if (isSelecting) {
            const didDragSelection = hasDragged(selectionStartX, selectionStartY, x, y);
            isSelecting = false;
            selectionBox = null;

            // pick primary shape (top-most inside selection)
            const selectedShapes = didDragSelection ? setSelection(selectedShapeIds) : [];
            if (!didDragSelection) {
                clearSelection();
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
            resetToSelectTool();
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
        resetToSelectTool();

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

    return {
        deleteSelection,
        hasSelection: () => selectedShapeIds.length > 0,
        getSelectedIds: () => [...selectedShapeIds],
        rerender: () => {
            const shapes = state.getShapes();
            const selected = getSelectedShapesByIds(shapes, selectedShapeIds);
            render(ctx, canvas, shapes, selectedShape, selectionBox, selected);
        },
    };
}
