import {render} from "../../renderer";
import {CanvasState} from "../../state";
import {PreviewShape, Shape} from "../../types";
import {Viewport} from "../../utils";
import {createPreviewShape} from "../preview";
import {DEFAULT_SHAPE_ROUGHNESS} from "./eventHelpers";
import {getSelectionBox, getSelectedShapesByIds, isShapeInsideBox, SelectionBox} from "../selection";
import {DefaultShapeStyle, Tool} from "../tools";

export function renderSelectionDragPreview(params: {
    x: number;
    y: number;
    selectionStartX: number;
    selectionStartY: number;
    shapes: Shape[];
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: Viewport;
    getScenePixelRatio: () => number;
}) {
    const {
        x,
        y,
        selectionStartX,
        selectionStartY,
        shapes,
        ctx,
        canvas,
        viewport,
        getScenePixelRatio,
    } = params;

    const selectionBox = getSelectionBox(selectionStartX, selectionStartY, x, y);
    const selectedShapes = shapes.filter((shape) => isShapeInsideBox(shape, selectionBox));
    const selectedShapeIds = selectedShapes.map((shape) => shape.id);

    render(ctx, canvas, shapes, null, selectionBox, selectedShapes, viewport, getScenePixelRatio());

    return {
        selectionBox,
        selectedShapeIds,
    };
}

export function renderFreehandPreview(params: {
    x: number;
    y: number;
    freehandPoints: Array<{x: number; y: number; t?: number}>;
    shapes: Shape[];
    selectedShape: Shape | null;
    selectedShapeIds: string[];
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: Viewport;
    getScenePixelRatio: () => number;
    defaultShapeStyle?: DefaultShapeStyle;
}) {
    const {
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
        defaultShapeStyle,
    } = params;

    const nextPoints = [...freehandPoints, {x, y, t: performance.now()}];

    const nextStyle = defaultShapeStyle ?? {};
    const preview: PreviewShape & DefaultShapeStyle = {
        type: "freehand",
        points: nextPoints,
        ...nextStyle,
        roughness: nextStyle.roughness ?? DEFAULT_SHAPE_ROUGHNESS,
        strokeStyle: nextStyle.strokeStyle ?? "solid",
    };

    render(
        ctx,
        canvas,
        [...shapes, {...preview, id: "__preview__"}],
        selectedShape,
        null,
        getSelectedShapesByIds(shapes, selectedShapeIds),
        viewport,
        getScenePixelRatio()
    );

    return nextPoints;
}

export function renderDrawPreview(params: {
    state: CanvasState;
    activeTool: Tool;
    startX: number;
    startY: number;
    x: number;
    y: number;
    preserveAspect: boolean;
    pendingShapeId: string | null;
    selectedShape: Shape | null;
    selectedShapeIds: string[];
    shapes: Shape[];
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: Viewport;
    getScenePixelRatio: () => number;
    connectorTargetHighlightIds?: string[];
    defaultShapeStyle?: DefaultShapeStyle;
}) {
    const {
        state,
        activeTool,
        startX,
        startY,
        x,
        y,
        preserveAspect,
        pendingShapeId,
        selectedShape,
        selectedShapeIds,
        shapes,
        ctx,
        canvas,
        viewport,
        getScenePixelRatio,
        connectorTargetHighlightIds,
        defaultShapeStyle,
    } = params;

    const previewShape = createPreviewShape(activeTool, startX, startY, x, y, {
        preserveAspect,
    });

    const shapesToRender = previewShape
        ? [
              ...shapes,
              {
                  ...previewShape,
                  id: pendingShapeId ?? "__preview__",
                  ...(defaultShapeStyle ?? {}),
                  roughness: defaultShapeStyle?.roughness ?? DEFAULT_SHAPE_ROUGHNESS,
                  strokeStyle: defaultShapeStyle?.strokeStyle ?? "solid",
              },
          ]
        : shapes;

    render(
        ctx,
        canvas,
        shapesToRender,
        selectedShape,
        null,
        getSelectedShapesByIds(state.getShapes(), selectedShapeIds),
        viewport,
        getScenePixelRatio(),
        connectorTargetHighlightIds ?? []
    );

    return previewShape;
}
