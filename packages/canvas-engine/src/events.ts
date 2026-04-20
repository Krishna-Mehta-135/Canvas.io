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
import {Viewport, getMousePos, screenToWorldPoint} from "./utils";
import {CanvasState} from "./state";
import {getShapeAtPoint, getShapesAtPoint} from "./interaction/hitDetection";
import {dispatch, findTopBindableShapeAtPoint, getConnectorSnapEnabled, setConnectorSnapEnabled} from "./store";
import {convertToPoints, resizeShape} from "./geometry";
import {AttachEventsController, AttachEventsOptions, isDrawableTool, Tool} from "./interaction/tools";
import {getCursorForHandle} from "./interaction/cursor";
import {getResizeTarget} from "./interaction/resizeTarget";
import {handleGlobalKeydown} from "./interaction/keyboard";
import {applySingleShapeDrag} from "./interaction/drag/dragging";
import {getDragAnchorsForShape} from "./interaction/drag/dragStart";
import {createTextEditingController} from "./interaction/text/textSession";
import {createReplayController} from "./interaction/replay/replayController";
import {attachViewportEvents} from "./interaction/events/viewportEvents";
import {
    applyShiftSelectionToggle,
    finalizeDrawCommit,
    finalizeEraserStroke,
    finalizeFreehandStroke,
} from "./interaction/events/pointerPhases";
import {
    renderDrawPreview,
    renderFreehandPreview,
    renderSelectionDragPreview,
} from "./interaction/events/pointerPreviews";
import {
    drawEraserTrail,
    getScenePixelRatio,
    SELECTION_PADDING,
} from "./interaction/events/eventHelpers";
import {
    getSelectedShapesByIds,
    hasDragged,
    SelectionBox,
} from "./interaction/selection";

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
    const getDefaultViewport = () => ({
        x: canvas.clientWidth / 2,
        y: canvas.clientHeight / 2,
        scale: 1,
    });

    let viewport: Viewport = options.initialViewport ?? getDefaultViewport();
    let isGridVisible = true;
    let isSnapEnabled = getConnectorSnapEnabled();

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
            pixelRatio,
            connectorTargetHighlightIds,
            isGridVisible
        );

        if (isErasing && eraserPoints.length > 0) {
            drawEraserTrail(ctx, eraserPoints, viewport, pixelRatio);
        }
    };

    const setViewport = (nextViewport: Viewport) => {
        viewport = nextViewport;
        options.onViewportChange?.(viewport);
        options.onCursorChange?.(lastPointer ? screenToWorldPoint(lastPointer, viewport) : null);
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
    let connectorTargetHighlightIds: string[] = [];

    let isSelecting = false;

    let selectionStartX = 0;
    let selectionStartY = 0;
    let dragMode: "single" | "multi" | null = null;
    let lastPointer: {x: number; y: number} | null = null;
    let isDestroyed = false;

    const getActiveTool = () => options.getTool?.() ?? currentTool;
    const getDefaultShapeStyle = () => options.getDefaultShapeStyle?.();

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
        connectorTargetHighlightIds = [];
        freehandPoints = [];
    };

    const collectConnectorTargetHighlights = (params: {
        shapes: Shape[];
        excludeId?: string | null;
        points: Array<{x: number; y: number}>;
    }) => {
        const {shapes, excludeId, points} = params;
        const ids = new Set<string>();

        points.forEach((point) => {
            const target = findTopBindableShapeAtPoint(shapes, point.x, point.y, excludeId);
            if (!target) return;
            ids.add(target.id);
        });

        connectorTargetHighlightIds = [...ids];
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
        const selectionBounds = selectedShapeIds.length > 0 ? getSelectionBounds(selectedShapeIds) : null;
        const isInsideSelectionBounds =
            !!selectionBounds &&
            worldPoint.x >= selectionBounds.x1 &&
            worldPoint.x <= selectionBounds.x2 &&
            worldPoint.y >= selectionBounds.y1 &&
            worldPoint.y <= selectionBounds.y2;

        if (resizeTarget) {
            canvas.style.cursor = getCursorForHandle(resizeTarget.handle);
        } else if (getActiveTool() === "select" && isInsideSelectionBounds && selectedShapeIds.length > 0) {
            canvas.style.cursor = "move";
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

    const isPointNearShapeEdge = (shape: Shape, x: number, y: number) => {
        const EDGE_TOLERANCE = 10;

        if (shape.type === "rect" || shape.type === "text") {
            const box = convertToPoints(shape);
            const isInside = x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2;
            if (!isInside) return false;

            const distToEdge = Math.min(
                Math.abs(x - box.x1),
                Math.abs(box.x2 - x),
                Math.abs(y - box.y1),
                Math.abs(box.y2 - y)
            );
            return distToEdge <= EDGE_TOLERANCE;
        }

        if (shape.type === "circle") {
            const rx = Math.max(1, shape.radiusX);
            const ry = Math.max(1, shape.radiusY);
            const dx = x - shape.centerX;
            const dy = y - shape.centerY;
            const normalized = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
            const radialTolerance = EDGE_TOLERANCE / Math.max(rx, ry);
            return normalized >= 1 - radialTolerance && normalized <= 1 + radialTolerance;
        }

        if (shape.type === "rhombus") {
            const width = Math.max(1, shape.width);
            const height = Math.max(1, shape.height);
            const centerX = shape.x + width / 2;
            const centerY = shape.y + height / 2;
            const nx = Math.abs(x - centerX) / (width / 2);
            const ny = Math.abs(y - centerY) / (height / 2);
            const diamondDistance = nx + ny;
            const tolerance = EDGE_TOLERANCE / Math.max(width / 2, height / 2);
            return diamondDistance >= 1 - tolerance && diamondDistance <= 1 + tolerance;
        }

        return false;
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

    const textEditingController = createTextEditingController({
        canvas,
        ctx,
        state,
        getViewport: () => viewport,
        renderScene,
        setSelection: (ids, primaryId) => {
            setSelection(ids, primaryId);
        },
        clearSelection,
        resetToSelectTool,
    });
    const startTextEditing = textEditingController.startTextEditing;

    const replayController = createReplayController({
        state,
        ctx,
        canvas,
        getSelectedShape: () => selectedShape,
        getSelectionBox: () => selectionBox,
        getSelectedShapeIds: () => [...selectedShapeIds],
        getViewport: () => viewport,
        getScenePixelRatio,
        renderScene,
    });

    const handleKeyDown = (e: KeyboardEvent) => {
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
    };

    const handleMouseDown = (e: MouseEvent) => {
        const screenPoint = getMousePos(canvas, e);
        lastPointer = screenPoint;
        options.onCursorChange?.(screenToWorldPoint(screenPoint, viewport));
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

        const active = getActiveTool();
        const resizeTarget =
            active === "select" ? getResizeTarget(shapes, x, y, selectedShape, SELECTION_PADDING, ctx) : null;
        const isConnectorResizeTarget =
            !!resizeTarget && (resizeTarget.shape.type === "line" || resizeTarget.shape.type === "arrow");
        const allowConnectorResize = isConnectorResizeTarget && selectedShape?.id === resizeTarget?.shape.id;

        if (resizeTarget && (!isConnectorResizeTarget || allowConnectorResize)) {
            isResizing = true;
            resizeSession = resizeTarget;
            setSelection([resizeTarget.shape.id], resizeTarget.shape.id);
            return;
        }

        const shape = getShapeAtPoint(shapes, x, y, ctx);

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

        if (!shape && getActiveTool() === "select" && selectedShapeIds.length === 1) {
            const bounds = getSelectionBounds(selectedShapeIds);
            const isInsideBounds =
                !!bounds && x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;

            if (isInsideBounds) {
                const selectedId = selectedShapeIds[0];
                const currentSelectedShape = selectedId ? shapes.find((item) => item.id === selectedId) : null;

                if (currentSelectedShape) {
                    selectedShape = currentSelectedShape;
                    isDragging = true;
                    dragMode = "single";

                    const anchors = getDragAnchorsForShape(currentSelectedShape, {x, y}, {offsetX, offsetY, prevX, prevY});
                    offsetX = anchors.offsetX;
                    offsetY = anchors.offsetY;
                    prevX = anchors.prevX;
                    prevY = anchors.prevY;

                    render(
                        ctx,
                        canvas,
                        state.getShapes(),
                        currentSelectedShape,
                        null,
                        getSelectedShapesByIds(state.getShapes(), selectedShapeIds),
                        viewport,
                        getScenePixelRatio(),
                        [],
                        isGridVisible
                    );
                    return;
                }
            }
        }

        if (shape && getActiveTool() === "select" && e.shiftKey) {
            const selectedShapes = applyShiftSelectionToggle(shape, selectedShapeIds, setSelection);

            render(ctx, canvas, shapes, selectedShape, null, selectedShapes, viewport, getScenePixelRatio(), [], isGridVisible);
            return;
        }

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

        if (shape && (active === "line" || active === "arrow") && shape.type !== "line" && shape.type !== "arrow") {
            if (!isPointNearShapeEdge(shape, x, y)) {
                setSelection([shape.id], shape.id);
                renderScene();
                return;
            }
        }

        if (shape && getActiveTool() === "select") {
            selectedShape = shape;
            isDragging = true;

            const isShapeInSelection = selectedShapeIds.includes(shape.id);
            if (isShapeInSelection && selectedShapeIds.length > 1) {
                dragMode = "multi";
                prevX = x;
                prevY = y;

                render(ctx, canvas, state.getShapes(), shape, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds), viewport, getScenePixelRatio(), [], isGridVisible);
                return;
            }

            setSelection([shape.id], shape.id);
            dragMode = "single";

            const anchors = getDragAnchorsForShape(shape, {x, y}, {offsetX, offsetY, prevX, prevY});
            offsetX = anchors.offsetX;
            offsetY = anchors.offsetY;
            prevX = anchors.prevX;
            prevY = anchors.prevY;

            render(ctx, canvas, state.getShapes(), shape, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds), viewport, getScenePixelRatio(), [], isGridVisible);
            return;
        }

        if (!shape && getActiveTool() === "select") {
            isSelecting = true;

            selectionStartX = x;
            selectionStartY = y;

            clearSelection();

            renderScene();
            return;
        }

        if (!isDrawableTool(active)) {
            connectorTargetHighlightIds = [];
            return;
        }

        activeTool = active;
        isDrawing = true;
        startX = x;
        startY = y;
        pendingShapeId = crypto.randomUUID();
        connectorTargetHighlightIds = [];
        clearSelection();
        renderScene();
    };

    const handleMouseMove = (e: MouseEvent) => {
        const screenPoint = getMousePos(canvas, e);
        lastPointer = screenPoint;
        options.onCursorChange?.(screenToWorldPoint(screenPoint, viewport));
        const {x, y} = screenToWorldPoint(screenPoint, viewport);

        const shapes = state.getShapes();

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

        updateCursor();

        const connectorDrawingTool = activeTool ?? getActiveTool();

        if (isResizing && resizeSession && (resizeSession.shape.type === "line" || resizeSession.shape.type === "arrow")) {
            const movingStart = resizeSession.handle === "start";
            const movingEnd = resizeSession.handle === "end";

            if (movingStart || movingEnd) {
                collectConnectorTargetHighlights({
                    shapes,
                    excludeId: resizeSession.shape.id,
                    points: [
                        {
                            x: movingStart ? x : resizeSession.shape.x1,
                            y: movingStart ? y : resizeSession.shape.y1,
                        },
                        {
                            x: movingEnd ? x : resizeSession.shape.x2,
                            y: movingEnd ? y : resizeSession.shape.y2,
                        },
                    ],
                });
            }
        } else if (isDrawing && (connectorDrawingTool === "line" || connectorDrawingTool === "arrow")) {
            collectConnectorTargetHighlights({
                shapes,
                excludeId: pendingShapeId,
                points: [
                    {x: startX, y: startY},
                    {x, y},
                ],
            });
        } else if (connectorTargetHighlightIds.length > 0) {
            connectorTargetHighlightIds = [];
        }

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
                getSelectedShapesByIds(state.getShapes(), selectedShapeIds),
                viewport,
                getScenePixelRatio(),
                connectorTargetHighlightIds,
                isGridVisible
            );
            return;
        }

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

                render(ctx, canvas, updatedShapes, selectedShape, null, updatedSelectedShapes, viewport, getScenePixelRatio(), [], isGridVisible);
                return;
            }

            const selected = selectedShape;

            const dragResult = applySingleShapeDrag({
                state,
                selected,
                pointer: {x, y},
                offsetX,
                offsetY,
                prevX,
                prevY,
            });
            if (!dragResult.handled) return;

            prevX = dragResult.prevX;
            prevY = dragResult.prevY;

            render(ctx, canvas, state.getShapes(), selected, null, getSelectedShapesByIds(state.getShapes(), selectedShapeIds), viewport, getScenePixelRatio(), [], isGridVisible);
            return;
        }

        if (isSelecting) {
            const selectionPreview = renderSelectionDragPreview({
                x,
                y,
                selectionStartX,
                selectionStartY,
                shapes,
                ctx,
                canvas,
                viewport,
                getScenePixelRatio,
            });
            selectionBox = selectionPreview.selectionBox;
            selectedShapeIds = selectionPreview.selectedShapeIds;
            emitSelectionChange();
            return;
        }

        if (isFreehandDrawing) {
            freehandPoints = renderFreehandPreview({
                x,
                y,
                freehandPoints,
                shapes,
                selectedShape,
                selectedShapeIds,
                ctx,
                canvas,
                viewport,
                getScenePixelRatio,
            });
            return;
        }

        if (!isDrawing || !activeTool || !isDrawableTool(activeTool)) return;

        previewShape = renderDrawPreview({
            state,
            activeTool,
            startX,
            startY,
            x,
            y,
            preserveAspect: e.shiftKey,
            pendingShapeId,
            selectedShape,
            selectedShapeIds,
            shapes,
            ctx,
            canvas,
            viewport,
            getScenePixelRatio,
            connectorTargetHighlightIds,
            defaultShapeStyle: getDefaultShapeStyle(),
        });
    };

    const handleMouseUp = (e: MouseEvent) => {
        const screenPoint = getMousePos(canvas, e);
        lastPointer = screenPoint;
        options.onCursorChange?.(screenToWorldPoint(screenPoint, viewport));
        const {x, y} = screenToWorldPoint(screenPoint, viewport);

        if (isPanning) {
            isPanning = false;
            connectorTargetHighlightIds = [];
            updateCursor();
            return;
        }

        if (isErasing) {
            isErasing = false;
            connectorTargetHighlightIds = [];

            const resetEraser = finalizeEraserStroke(state, erasedShapeIds, resetToSelectTool, updateCursor, renderScene);
            eraserPoints = resetEraser.eraserPoints;
            erasedShapeIds = resetEraser.erasedShapeIds;
            return;
        }

        if (isFreehandDrawing) {
            isFreehandDrawing = false;
            connectorTargetHighlightIds = [];

            freehandPoints = finalizeFreehandStroke(
                state,
                freehandPoints,
                setSelection,
                renderScene,
                resetToSelectTool,
                getDefaultShapeStyle()
            );
            return;
        }

        if (isSelecting) {
            const didDragSelection = hasDragged(selectionStartX, selectionStartY, x, y);
            isSelecting = false;
            selectionBox = null;
            connectorTargetHighlightIds = [];

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
            connectorTargetHighlightIds = [];
            return;
        }

        finalizeDrawCommit({
            state,
            activeTool,
            startX,
            startY,
            x,
            y,
            preserveAspect: e.shiftKey,
            pendingShapeId,
            setSelection,
            resetToSelectTool,
            renderScene,
            hasDragged,
            defaultShapeStyle: getDefaultShapeStyle(),
        });

        isDrawing = false;
        activeTool = null;
        previewShape = null;
        pendingShapeId = null;
        connectorTargetHighlightIds = [];
    };

    const handleDoubleClick = (e: MouseEvent) => {
        const screenPoint = getMousePos(canvas, e);
        lastPointer = screenPoint;
        options.onCursorChange?.(screenToWorldPoint(screenPoint, viewport));
        const {x, y} = screenToWorldPoint(screenPoint, viewport);
        const shape = getShapeAtPoint(state.getShapes(), x, y, ctx);
        if (!shape || shape.type !== "text") return;

        startTextEditing(shape.x, shape.y, shape);
    };

    window.addEventListener("keydown", handleKeyDown);

    const detachViewportEvents = attachViewportEvents({
        canvas,
        getViewport: () => viewport,
        setViewport,
        setLastPointer: (point) => {
            lastPointer = point;
        },
        updateCursor,
        renderScene,
        isInteractionActive: () => isPanning || isErasing || isFreehandDrawing || isDrawing || isDragging || isSelecting || isResizing,
        shouldRepaintOnReset: () => isErasing || isFreehandDrawing || isDrawing || isDragging || isSelecting || isResizing,
        resetInteractions: stopTransientInteractions,
        resetToSelectTool,
        releaseSpacePan: () => {
            spacePressed = false;
        },
    });

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("dblclick", handleDoubleClick);
    const handleMouseLeave = () => {
        lastPointer = null;
        options.onCursorChange?.(null);
    };
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return {
        deleteSelection,
        hasSelection: () => selectedShapeIds.length > 0,
        getSelectedIds: () => [...selectedShapeIds],
        resetViewport: () => {
            stopTransientInteractions();
            selectionBox = null;
            setViewport(getDefaultViewport());
            updateCursor();
            renderScene();
        },
        setGridVisible: (visible: boolean) => {
            isGridVisible = visible;
            renderScene();
        },
        isGridVisible: () => isGridVisible,
        setSnapEnabled: (enabled: boolean) => {
            isSnapEnabled = enabled;
            setConnectorSnapEnabled(enabled);

            if (!enabled) {
                const shapes = state.getShapes().map((shape) => {
                    if (shape.type !== "line" && shape.type !== "arrow") return shape;
                    return {
                        ...shape,
                        startBinding: undefined,
                        endBinding: undefined,
                    };
                });
                state.setShapes(shapes);
            }

            renderScene();
        },
        isSnapEnabled: () => isSnapEnabled,
        rerender: () => {
            const shapes = state.getShapes();
            const selected = getSelectedShapesByIds(shapes, selectedShapeIds);
            render(
                ctx,
                canvas,
                shapes,
                selectedShape,
                selectionBox,
                selected,
                viewport,
                getScenePixelRatio(),
                connectorTargetHighlightIds,
                isGridVisible
            );
        },
        replayShape: replayController.replayShape,
        destroy: () => {
            if (isDestroyed) {
                return;
            }

            isDestroyed = true;
            window.removeEventListener("keydown", handleKeyDown);
            canvas.removeEventListener("mousedown", handleMouseDown);
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("mouseup", handleMouseUp);
            canvas.removeEventListener("dblclick", handleDoubleClick);
            canvas.removeEventListener("mouseleave", handleMouseLeave);
            detachViewportEvents();
            textEditingController.dispose();
        },
    };
}
