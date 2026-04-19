import {CanvasState} from "../../state";
import {dispatch} from "../../store";
import {Shape} from "../../types";

type DragPointer = {x: number; y: number};

type DragParams = {
    state: CanvasState;
    selected: Shape;
    pointer: DragPointer;
    offsetX: number;
    offsetY: number;
    prevX: number;
    prevY: number;
};

type DragResult = {
    handled: boolean;
    prevX: number;
    prevY: number;
};

export function applySingleShapeDrag(params: DragParams): DragResult {
    const {state, selected, pointer, offsetX, offsetY, prevX, prevY} = params;
    const {x, y} = pointer;

    if (selected.type === "rect" || selected.type === "rhombus") {
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

        return {handled: true, prevX, prevY};
    }

    if (selected.type === "circle") {
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

        return {handled: true, prevX, prevY};
    }

    if (selected.type === "line" || selected.type === "arrow") {
        const current = state.getShapes().find((shape) => shape.id === selected.id);
        if (!current || (current.type !== "line" && current.type !== "arrow")) {
            return {handled: false, prevX, prevY};
        }

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
                    startBinding: undefined,
                    endBinding: undefined,
                },
                skipConnectorBindingRefresh: true,
            },
        });

        return {
            handled: true,
            prevX: x,
            prevY: y,
        };
    }

    if (selected.type === "text") {
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

        return {handled: true, prevX, prevY};
    }

    if (selected.type === "freehand") {
        const current = state.getShapes().find((shape) => shape.id === selected.id);
        if (!current || current.type !== "freehand") {
            return {handled: false, prevX, prevY};
        }

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

        return {
            handled: true,
            prevX: x,
            prevY: y,
        };
    }

    return {handled: false, prevX, prevY};
}
