import {render} from "../../renderer";
import {CanvasState} from "../../state";
import {dispatch} from "../../store";
import {Shape} from "../../types";
import {Viewport, worldToScreenPoint} from "../../utils";
import {convertToPoints} from "../../geometry";
import {createInlineTextEditor} from "./textEditor";
import {getWrappedTextLines} from "../../textLayout";
import {getFittedTextFontSize} from "../../textMetrics";
import {DEFAULT_SHAPE_ROUGHNESS, getPreviewTextColor, getScenePixelRatio} from "../events/eventHelpers";

type TextShape = Extract<Shape, {type: "text"}>;
type NonTextShape = Exclude<Shape, TextShape>;

type CreateTextEditingControllerOptions = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    state: CanvasState;
    getViewport: () => Viewport;
    renderScene: () => void;
    setSelection: (ids: string[], primaryId?: string | null) => void;
    clearSelection: () => void;
    resetToSelectTool: () => void;
};

export function createTextEditingController(options: CreateTextEditingControllerOptions) {
    const {canvas, ctx, state, getViewport, renderScene, setSelection, clearSelection, resetToSelectTool} = options;
    let activeTextEditorCleanup: (() => void) | null = null;

    const startTextEditing = (x: number, y: number, existing?: TextShape, parentShape?: NonTextShape) => {
        if (activeTextEditorCleanup) {
            activeTextEditorCleanup();
            activeTextEditorCleanup = null;
        }

        const viewport = getViewport();
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
                const liveViewport = getViewport();

                // Live preview: render text on canvas as user types.
                // While editing an existing text shape, hide that old shape to avoid doubled text.
                const previewShapes = existing
                    ? state.getShapes().filter((shape) => shape.id !== existing.id)
                    : state.getShapes();

                render(ctx, canvas, previewShapes, null, null, [], liveViewport, getScenePixelRatio());

                ctx.save();
                const pixelRatio = getScenePixelRatio();
                ctx.setTransform(
                    pixelRatio * liveViewport.scale,
                    0,
                    0,
                    pixelRatio * liveViewport.scale,
                    pixelRatio * liveViewport.x,
                    pixelRatio * liveViewport.y
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

                const textShape: TextShape = {
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

    const dispose = () => {
        if (activeTextEditorCleanup) {
            activeTextEditorCleanup();
            activeTextEditorCleanup = null;
        }
    };

    return {
        startTextEditing,
        dispose,
    };
}
