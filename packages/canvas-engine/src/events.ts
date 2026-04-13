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
import {Viewport, clamp, getMousePos, screenToWorldPoint, worldToScreenPoint} from "./utils";
import {CanvasState} from "./state";
import {getShapeAtPoint, getShapesAtPoint} from "./interaction/hitDetection";
import {dispatch} from "./store";
import {convertToPoints, resizeShape} from "./geometry";
import {AttachEventsController, AttachEventsOptions, isDrawableTool, Tool} from "./interaction/tools";
import {createPreviewShape} from "./interaction/preview";
import {getCursorForHandle} from "./interaction/cursor";
import {getResizeTarget} from "./interaction/resizeTarget";
import {createInlineTextEditor} from "./interaction/textEditor";
import {handleGlobalKeydown} from "./interaction/keyboard";
import {getWrappedTextLines} from "./textLayout";
import {getFittedTextFontSize} from "./textMetrics";
import {
    getSelectedShapesByIds,
    getSelectionBox,
    hasDragged,
    isShapeInsideBox,
    SelectionBox,
} from "./interaction/selection";

const SELECTION_PADDING = 6;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4;
const WHEEL_ZOOM_SENSITIVITY = 0.0035;
const WHEEL_PAN_SENSITIVITY = 1;
const DEFAULT_SHAPE_ROUGHNESS = 1.8;
const ERASER_SAMPLE_DISTANCE = 6;

function getPixelRatio() {
    return window.devicePixelRatio || 1;
}

function resizeCanvasForViewport(canvas: HTMLCanvasElement) {
    const pixelRatio = getPixelRatio();
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    return {width, height, pixelRatio};
}

function getScenePixelRatio() {
    return window.devicePixelRatio || 1;
}

function getPreviewTextColor() {
    if (typeof document === "undefined") return "#f8fafc";

    const theme = document.documentElement.getAttribute("data-theme");
    return theme === "light" ? "#1f2937" : "#f8fafc";
}

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
    let viewport: Viewport = options.initialViewport ?? {
        x: canvas.width / 2,
        y: canvas.height / 2,
        scale: 1,
    };

    let selectedShape: Shape | null = null;
    let selectionBox: SelectionBox | null = null;
    let selectedShapeIds: string[] = [];

    const renderScene = () => {
        const pixelRatio = getScenePixelRatio();
        const shapes = state.getShapes();
        const renderedShapes =
            isErasing || erasedShapeIds.size > 0
                ? shapes.map((shape) =>
                      erasedShapeIds.has(shape.id)
                          ? {
                                ...shape,
                                opacity: Math.min(shape.opacity ?? 100, 25),
                            }
                          : shape
                  )
                : shapes;

        render(
            ctx,
            canvas,
            renderedShapes,
            selectedShape,
            selectionBox,
            getSelectedShapesByIds(renderedShapes, selectedShapeIds),
            viewport,
            pixelRatio
        );

        if (isErasing && eraserPoints.length > 0) {
            drawEraserTrail(ctx, eraserPoints, viewport, pixelRatio);
        }
    };

    const setViewport = (nextViewport: Viewport) => {
        viewport = nextViewport;
        options.onViewportChange?.(viewport);
    };

    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let previewShape: PreviewShape | null = null;
    let pendingShapeId: string | null = null;
    let isDragging = false;

    let offsetX = 0;
    let offsetY = 0;

    let prevX = 0;
    let prevY = 0;

    let isResizing = false;
    let isFreehandDrawing = false;
    let freehandPoints: Array<{x: number; y: number}> = [];
    let isErasing = false;
    let eraserPoints: Array<{x: number; y: number}> = [];
    let erasedShapeIds = new Set<string>();
    let replayFrameId: number | null = null;
    let isPanning = false;
    let spacePressed = false;
    let panStartX = 0;
    let panStartY = 0;
    let panOriginX = 0;
    let panOriginY = 0;

    let resizeSession: {
        shape: Shape;
        handle: Handle;
    } | null = null;

    let currentTool: Tool = options.getTool?.() ?? "select";
    let activeTool: Tool | null = null;

    let isSelecting = false;

    let selectionStartX = 0;
    let selectionStartY = 0;
    let dragMode: "single" | "multi" | null = null;
    let activeTextEditorCleanup: (() => void) | null = null;
    let lastPointer: {x: number; y: number} | null = null;

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

    const stopTransientInteractions = () => {
        isPanning = false;
        isErasing = false;
        isFreehandDrawing = false;
        isDrawing = false;
        isDragging = false;
        isSelecting = false;
        isResizing = false;
        dragMode = null;
        resizeSession = null;
        eraserPoints = [];
        erasedShapeIds = new Set();
        previewShape = null;
        activeTool = null;
        freehandPoints = [];
    };

    const touchEraserPoint = (point: {x: number; y: number}) => {
        const touchedShapes = getShapesAtPoint(state.getShapes(), point.x, point.y, ctx);

        let changed = false;
        for (const shape of touchedShapes) {
            if (erasedShapeIds.has(shape.id)) continue;
            erasedShapeIds.add(shape.id);
            changed = true;
        }

        if (changed) {
            selectedShapeIds = selectedShapeIds.filter((id) => !erasedShapeIds.has(id));
            if (selectedShape && selectedShapeIds.indexOf(selectedShape.id) === -1 && erasedShapeIds.has(selectedShape.id)) {
                selectedShape = null;
            }
            emitSelectionChange();
        }
    };

    const touchEraserSegment = (from: {x: number; y: number}, to: {x: number; y: number}) => {
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const steps = Math.max(1, Math.ceil(distance / ERASER_SAMPLE_DISTANCE));

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            touchEraserPoint({
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t,
            });
        }
    };

    const drawEraserTrail = (
        drawingCtx: CanvasRenderingContext2D,
        points: Array<{x: number; y: number}>,
        currentViewport: Viewport,
        pixelRatio: number
    ) => {
        if (points.length === 0) return;

        const screenPoints = points.map((point) => worldToScreenPoint(point, currentViewport));

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
    };

    renderScene();

    const updateCursor = () => {
        if (isPanning) {
            canvas.style.cursor = "grabbing";
            return;
        }

        if (spacePressed) {
            canvas.style.cursor = "grab";
            return;
        }

        if (!lastPointer) {
            canvas.style.cursor = "default";
            return;
        }

        const worldPoint = screenToWorldPoint(lastPointer, viewport);
        const shapes = state.getShapes();
        const resizeTarget = getResizeTarget(shapes, worldPoint.x, worldPoint.y, selectedShape, SELECTION_PADDING, ctx);
        const shape = getShapeAtPoint(shapes, worldPoint.x, worldPoint.y, ctx);

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
        renderScene();
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
        const initialLineHeight = Math.round(fontSize * 1.25);

        // Parent box constrains initial text width/height when text is bound to a parent shape.
        const parentBox = parentShape ? convertToPoints(parentShape) : null;
        const parentPadding = 8;
        const textStartX = parentBox
            ? Math.min(Math.max(x, parentBox.x1 + parentPadding), Math.max(parentBox.x1 + parentPadding, parentBox.x2 - parentPadding - 8))
            : x;
        const textStartY = parentBox
            ? Math.min(
                Math.max(y, parentBox.y1 + parentPadding),
                Math.max(parentBox.y1 + parentPadding, parentBox.y2 - parentPadding - initialLineHeight)
            )
            : y;
        const maxPreviewWidth = parentBox
            ? Math.max(8, parentBox.x2 - textStartX - parentPadding)
            : Number.MAX_SAFE_INTEGER;

        const editorPoint = worldToScreenPoint({x: textStartX, y: textStartY}, viewport);

        activeTextEditorCleanup = createInlineTextEditor({
            canvas,
            screenX: editorPoint.x,
            screenY: editorPoint.y,
            ctx,
            initialText: existing?.text ?? "",
            fontSize,
            onInput: (text) => {
                // Live preview: render text on canvas as user types.
                // While editing an existing text shape, hide that old shape to avoid doubled text.
                const previewShapes = existing
                    ? state.getShapes().filter((shape) => shape.id !== existing.id)
                    : state.getShapes();

                render(ctx, canvas, previewShapes, null, null, [], viewport, getScenePixelRatio());

                ctx.save();
                const pixelRatio = getScenePixelRatio();
                ctx.setTransform(
                    pixelRatio * viewport.scale,
                    0,
                    0,
                    pixelRatio * viewport.scale,
                    pixelRatio * viewport.x,
                    pixelRatio * viewport.y
                );

                // Draw using current theme color so preview remains visible in light and dark modes.
                ctx.fillStyle = existing?.stroke || getPreviewTextColor();
                ctx.textBaseline = "top";
                const previewWidth = existing ? existing.width : maxPreviewWidth;
                const previewHeight = existing
                    ? existing.height
                    : parentBox
                        ? Math.max(8, parentBox.y2 - textStartY - parentPadding)
                        : Number.MAX_SAFE_INTEGER;

                const fittedPreviewFontSize = getFittedTextFontSize(
                    ctx,
                    text,
                    previewWidth,
                    previewHeight,
                    existing?.fontSize ?? fontSize
                );
                const previewLineHeight = fittedPreviewFontSize * 1.25;
                ctx.font = `${fittedPreviewFontSize}px Virgil, Caveat, ui-rounded, sans-serif`;
                // Use the same wrapping helper as final renderer so preview matches committed output.
                const wrappedLines = getWrappedTextLines(ctx, text, previewWidth);
                const maxY = textStartY + previewHeight;

                wrappedLines.forEach((line, index) => {
                    const drawY = textStartY + index * previewLineHeight;
                    if (drawY + previewLineHeight > maxY) return;
                    ctx.fillText(line, textStartX, drawY);
                });

                ctx.restore();
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
                        renderScene();
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
                    renderScene();
                    resetToSelectTool();
                    return;
                }

                const textShape: Extract<Shape, {type: "text"}> = {
                    id: crypto.randomUUID(),
                    type: "text",
                    x: textStartX,
                    y: textStartY,
                    text: trimmed,
                    fontSize: newFontSize,
                    width: Math.max(8, Math.min(width, maxPreviewWidth)),
                    height,
                    parentId: parentShape?.id,
                    roughness: DEFAULT_SHAPE_ROUGHNESS,
                    strokeStyle: "solid",
                };

                ctx.save();
                ctx.font = `${newFontSize}px Virgil, Caveat, ui-rounded, sans-serif`;
                const wrappedLines = getWrappedTextLines(ctx, trimmed, textShape.width);
                ctx.restore();
                const wrappedLineHeight = newFontSize * 1.25;
                const contentHeight = Math.max(wrappedLineHeight, wrappedLines.length * wrappedLineHeight);
                textShape.height = parentBox
                    ? Math.min(contentHeight, Math.max(8, parentBox.y2 - textStartY - parentPadding))
                    : contentHeight;

                dispatch(state, {
                    type: "ADD_SHAPE",
                    payload: textShape,
                });

                setSelection([textShape.id], textShape.id);
                renderScene();
                resetToSelectTool();
            },
            onCancel: () => {
                activeTextEditorCleanup = null;
                renderScene();
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

        if (e.code === "Space") {
            e.preventDefault();
            spacePressed = true;
            updateCursor();
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

                renderScene();
            },
            undo: () => {
                state.undo();
                clearSelection();
                renderScene();
            },
            redo: () => {
                state.redo();
                clearSelection();
                renderScene();
            },
        });
    });

    window.addEventListener("mouseup", () => {
        if (!isPanning && !isErasing && !isFreehandDrawing && !isDrawing && !isDragging && !isSelecting && !isResizing) {
            return;
        }

        // If the pointer is released outside the canvas, the canvas never receives mouseup.
        // Clear transient interaction state here so selected shapes don't keep tracking the cursor.
        const shouldRepaint = isErasing || isFreehandDrawing || isDrawing || isDragging || isSelecting || isResizing;
        stopTransientInteractions();
        resetToSelectTool();
        updateCursor();

        if (shouldRepaint) {
            renderScene();
        }
    });

    window.addEventListener("blur", () => {
        if (!isPanning && !isErasing && !isFreehandDrawing && !isDrawing && !isDragging && !isSelecting && !isResizing) {
            return;
        }

        stopTransientInteractions();
        resetToSelectTool();
        updateCursor();
        renderScene();
    });

    window.addEventListener("keyup", (e) => {
        if (e.code === "Space") {
            spacePressed = false;
            updateCursor();
        }
    });

    window.addEventListener("resize", () => {
        const previousWidth = canvas.width;
        const previousHeight = canvas.height;
        const {width, height, pixelRatio} = resizeCanvasForViewport(canvas);

        if (previousWidth > 0 && previousHeight > 0) {
            const previousCssWidth = previousWidth / pixelRatio;
            const previousCssHeight = previousHeight / pixelRatio;
            setViewport({
                ...viewport,
                x: viewport.x + (width - previousCssWidth) / 2,
                y: viewport.y + (height - previousCssHeight) / 2,
            });
        }

        renderScene();
    });

    canvas.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();

            const pointer = getMousePos(canvas, e as unknown as MouseEvent);
            lastPointer = pointer;

            const normalizedDeltaY =
                e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;

            if (e.ctrlKey || e.metaKey) {
                const worldPoint = screenToWorldPoint(pointer, viewport);
                const zoomFactor = Math.exp(-normalizedDeltaY * WHEEL_ZOOM_SENSITIVITY);
                const nextScale = clamp(viewport.scale * zoomFactor, MIN_ZOOM, MAX_ZOOM);

                setViewport({
                    scale: nextScale,
                    x: pointer.x - worldPoint.x * nextScale,
                    y: pointer.y - worldPoint.y * nextScale,
                });

                updateCursor();
                renderScene();
                return;
            }

            setViewport({
                ...viewport,
                x: viewport.x - e.deltaX * WHEEL_PAN_SENSITIVITY,
                y: viewport.y - e.deltaY * WHEEL_PAN_SENSITIVITY,
            });

            updateCursor();
            renderScene();
        },
        {passive: false}
    );

    /* ---------------- MOUSEDOWN ---------------- */

    canvas.addEventListener("mousedown", (e) => {
        const screenPoint = getMousePos(canvas, e);
        lastPointer = screenPoint;
        const {x, y} = screenToWorldPoint(screenPoint, viewport);
        const shapes = state.getShapes();

        if (e.button === 1 || spacePressed) {
            isPanning = true;
            panStartX = screenPoint.x;
            panStartY = screenPoint.y;
            panOriginX = viewport.x;
            panOriginY = viewport.y;
            canvas.style.cursor = "grabbing";
            return;
        }

        if (getActiveTool() === "eraser") {
            e.preventDefault();
            isErasing = true;
            eraserPoints = [{x, y}];
            erasedShapeIds = new Set();
            clearSelection();
            touchEraserPoint({x, y});
            renderScene();
            return;
        }

        const resizeTarget = getResizeTarget(shapes, x, y, selectedShape, SELECTION_PADDING, ctx);

        // RESIZE
        if (resizeTarget) {
            isResizing = true;
            resizeSession = resizeTarget;
            setSelection([resizeTarget.shape.id], resizeTarget.shape.id);
            return;
        }

        const shape = getShapeAtPoint(shapes, x, y, ctx);

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

                renderScene();
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

            render(ctx, canvas, shapes, selectedShape, null, selectedShapes, viewport, getScenePixelRatio());
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

                render(ctx, canvas, state.getShapes(), shape, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds), viewport, getScenePixelRatio());
                return;
            }

            setSelection([shape.id], shape.id);
            dragMode = "single";

            if (shape.type === "rect") {
                offsetX = x - shape.x;
                offsetY = y - shape.y;
            } else if (shape.type === "rhombus") {
                offsetX = x - shape.x;
                offsetY = y - shape.y;
            } else if (shape.type === "circle") {
                offsetX = x - shape.centerX;
                offsetY = y - shape.centerY;
            } else if (shape.type === "line" || shape.type === "arrow") {
                prevX = x;
                prevY = y;
            } else if (shape.type === "text") {
                offsetX = x - shape.x;
                offsetY = y - shape.y;
            } else if (shape.type === "freehand") {
                prevX = x;
                prevY = y;
            }

            render(ctx, canvas, state.getShapes(), shape, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds), viewport, getScenePixelRatio());
            return;
        }

        // EMPTY CLICK
        if (!shape && getActiveTool() === "select") {
            isSelecting = true;

            selectionStartX = x;
            selectionStartY = y;

            clearSelection();

            renderScene();
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
        pendingShapeId = crypto.randomUUID();
        clearSelection();
        renderScene();
    });

    /* ---------------- MOUSEMOVE ---------------- */

    canvas.addEventListener("mousemove", (e) => {
        const screenPoint = getMousePos(canvas, e);
        lastPointer = screenPoint;
        const {x, y} = screenToWorldPoint(screenPoint, viewport);

        const shapes = state.getShapes();
        const resizeTarget = getResizeTarget(shapes, x, y, selectedShape, SELECTION_PADDING, ctx);
        const shape = getShapeAtPoint(shapes, x, y, ctx);

        if (isPanning) {
            setViewport({
                ...viewport,
                x: panOriginX + (screenPoint.x - panStartX),
                y: panOriginY + (screenPoint.y - panStartY),
            });

            updateCursor();
            renderScene();
            return;
        }

        if (isErasing) {
            eraserPoints = [...eraserPoints, {x, y}];
            touchEraserPoint({x, y});
            renderScene();
            return;
        }

        if (resizeTarget) {
            canvas.style.cursor = getCursorForHandle(resizeTarget.handle);
        } else if (shape) {
            canvas.style.cursor = "move";
        } else if (spacePressed) {
            canvas.style.cursor = "grab";
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
            render(ctx, canvas, state.getShapes(), updated || null, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds), viewport, getScenePixelRatio());
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

                render(ctx, canvas, updatedShapes, selectedShape, null, updatedSelectedShapes, viewport, getScenePixelRatio());
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
            } else if (selected.type === "rhombus") {
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
            } else if (selected.type === "line" || selected.type === "arrow") {
                const current = state.getShapes().find((s) => s.id === selected.id);
                if (!current || (current.type !== "line" && current.type !== "arrow")) return;

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

            render(ctx, canvas, state.getShapes(), selected, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds), viewport, getScenePixelRatio());
            return;
        }

        // ---------------- SELECTION BOX ----------------
        if (isSelecting) {
            const currentSelectionBox = getSelectionBox(selectionStartX, selectionStartY, x, y);
            selectionBox = currentSelectionBox;

            const selectedShapes = shapes.filter((s) => isShapeInsideBox(s, currentSelectionBox));
            selectedShapeIds = selectedShapes.map((shape) => shape.id);
            emitSelectionChange();

            render(ctx, canvas, shapes, null, selectionBox, selectedShapes, viewport, getScenePixelRatio());
            return;
        }

        if (isFreehandDrawing) {
            freehandPoints = [...freehandPoints, {x, y}];

            const preview: PreviewShape = {
                type: "freehand",
                points: freehandPoints,
            };

            render(ctx, canvas, [...shapes, {...preview, id: "__preview__"}], selectedShape, null, getSelectedShapesByIds(shapes, selectedShapeIds), viewport, getScenePixelRatio());
            return;
        }

        // DRAW PREVIEW
        if (!isDrawing || !activeTool || !isDrawableTool(activeTool)) return;

        previewShape = createPreviewShape(activeTool, startX, startY, x, y, {
            preserveAspect: e.shiftKey,
        });

        let shapesToRender = shapes;

        if (previewShape) {
            shapesToRender = [...shapes, {...previewShape, id: pendingShapeId ?? "__preview__", roughness: DEFAULT_SHAPE_ROUGHNESS}];
        }

        render(ctx, canvas, shapesToRender, selectedShape, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds), viewport, getScenePixelRatio());
    });

    /* ---------------- MOUSEUP ---------------- */

    canvas.addEventListener("mouseup", (e) => {
        const screenPoint = getMousePos(canvas, e);
        lastPointer = screenPoint;
        const {x, y} = screenToWorldPoint(screenPoint, viewport);

        if (isPanning) {
            isPanning = false;
            updateCursor();
            return;
        }

        if (isErasing) {
            isErasing = false;

            if (erasedShapeIds.size > 0) {
                dispatch(state, {
                    type: "DELETE_SHAPES",
                    payload: {
                        ids: Array.from(erasedShapeIds),
                    },
                });
            }

            eraserPoints = [];
            erasedShapeIds = new Set();
            resetToSelectTool();
            updateCursor();
            renderScene();
            return;
        }

        if (isFreehandDrawing) {
            isFreehandDrawing = false;

            if (freehandPoints.length > 1) {
                const freehandShape: Extract<Shape, {type: "freehand"}> = {
                    id: crypto.randomUUID(),
                    type: "freehand",
                    points: freehandPoints,
                    roughness: DEFAULT_SHAPE_ROUGHNESS,
                    strokeStyle: "solid",
                };

                dispatch(state, {
                    type: "ADD_SHAPE",
                    payload: freehandShape,
                });

                setSelection([freehandShape.id], freehandShape.id);
            }

            freehandPoints = [];
            renderScene();
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

            renderScene();
            return;
        }

        if (isResizing) {
            isResizing = false;
            resizeSession = null;
            return;
        }


        if (!hasDragged(startX, startY, x, y)) {
            isDrawing = false;
            activeTool = null;
            previewShape = null;
            pendingShapeId = null;
            renderScene();
            resetToSelectTool();
            return;
        }

        const drawingTool = activeTool as Tool;
        const preview = createPreviewShape(drawingTool, startX, startY, x, y, {
            preserveAspect: e.shiftKey,
        });

        if (!preview) {
            isDrawing = false;
            activeTool = null;
            previewShape = null;
            pendingShapeId = null;
            renderScene();
            resetToSelectTool();
            return;
        }

        const newShapeId = pendingShapeId ?? crypto.randomUUID();

        dispatch(state, {
            type: "ADD_SHAPE",
            payload: {
                ...preview,
                id: newShapeId,
                roughness: DEFAULT_SHAPE_ROUGHNESS,
                strokeStyle: "solid",
            },
        });

        setSelection([newShapeId], newShapeId);

        isDrawing = false;
        activeTool = null;
        previewShape = null;
        pendingShapeId = null;
        resetToSelectTool();

        renderScene();
    });

    canvas.addEventListener("dblclick", (e) => {
        const screenPoint = getMousePos(canvas, e);
        lastPointer = screenPoint;
        const {x, y} = screenToWorldPoint(screenPoint, viewport);
        const shape = getShapeAtPoint(state.getShapes(), x, y, ctx);
        if (!shape || shape.type !== "text") return;

        startTextEditing(shape.x, shape.y, shape);
    });

    const replayShape = (shapeId: string) => {
        const target = state.getShapes().find((shape) => shape.id === shapeId);
        if (!target || target.type !== "freehand" || target.points.length < 2) {
            return;
        }

        if (replayFrameId !== null) {
            cancelAnimationFrame(replayFrameId);
            replayFrameId = null;
        }

        const totalPoints = target.points.length;
        const step = Math.max(1, Math.floor(totalPoints / 80));
        let visiblePoints = 2;

        const drawFrame = () => {
            const currentShapes = state.getShapes();
            const baseShapes = currentShapes.filter((shape) => shape.id !== shapeId);
            const replayShape = {
                ...target,
                id: "__replay__",
                points: target.points.slice(0, visiblePoints),
            };

            render(
                ctx,
                canvas,
                [...baseShapes, replayShape],
                selectedShape,
                selectionBox,
                getSelectedShapesByIds(currentShapes, selectedShapeIds),
                viewport,
                getScenePixelRatio()
            );

            if (visiblePoints >= totalPoints) {
                replayFrameId = null;
                renderScene();
                return;
            }

            visiblePoints = Math.min(totalPoints, visiblePoints + step);
            replayFrameId = requestAnimationFrame(drawFrame);
        };

        drawFrame();
    };

    return {
        deleteSelection,
        hasSelection: () => selectedShapeIds.length > 0,
        getSelectedIds: () => [...selectedShapeIds],
        rerender: () => {
            const shapes = state.getShapes();
            const selected = getSelectedShapesByIds(shapes, selectedShapeIds);
            render(ctx, canvas, shapes, selectedShape, selectionBox, selected, viewport, getScenePixelRatio());
        },
        replayShape,
    };
}
