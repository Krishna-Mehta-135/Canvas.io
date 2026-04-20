import {render} from "../../renderer";
import {CanvasState} from "../../state";
import {Shape} from "../../types";
import {Viewport} from "../../utils";
import {SelectionBox, getSelectedShapesByIds} from "../selection";

type CreateReplayControllerOptions = {
    state: CanvasState;
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    getSelectedShape: () => Shape | null;
    getSelectionBox: () => SelectionBox | null;
    getSelectedShapeIds: () => string[];
    getViewport: () => Viewport;
    getScenePixelRatio: () => number;
    renderScene: () => void;
};

export function createReplayController(options: CreateReplayControllerOptions) {
    const {
        state,
        ctx,
        canvas,
        getSelectedShape,
        getSelectionBox,
        getSelectedShapeIds,
        getViewport,
        getScenePixelRatio,
        renderScene,
    } = options;

    let replayFrameId: number | null = null;

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
        const hasTiming = target.points.every((point) => typeof point.t === "number");
        const firstPointTime = hasTiming ? (target.points[0]?.t as number) : 0;
        const replayStartTime = performance.now();

        const drawFrame = () => {
            if (hasTiming) {
                const elapsedMs = performance.now() - replayStartTime;

                while (
                    visiblePoints < totalPoints &&
                    ((target.points[visiblePoints]?.t as number) - firstPointTime) <= elapsedMs
                ) {
                    visiblePoints += 1;
                }

                visiblePoints = Math.max(2, Math.min(totalPoints, visiblePoints));
            }

            const currentShapes = state.getShapes();
            const baseShapes = currentShapes.filter((shape) => shape.id !== shapeId);
            const replayPreviewShape = {
                ...target,
                id: "__replay__",
                points: target.points.slice(0, visiblePoints),
            };

            render(
                ctx,
                canvas,
                [...baseShapes, replayPreviewShape],
                getSelectedShape(),
                getSelectionBox(),
                getSelectedShapesByIds(currentShapes, getSelectedShapeIds()),
                getViewport(),
                getScenePixelRatio()
            );

            if (visiblePoints >= totalPoints) {
                replayFrameId = null;
                renderScene();
                return;
            }

            if (!hasTiming) {
                visiblePoints = Math.min(totalPoints, visiblePoints + step);
            }
            replayFrameId = requestAnimationFrame(drawFrame);
        };

        drawFrame();
    };

    return {
        replayShape,
    };
}
