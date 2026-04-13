import {Shape} from "../../types";

type Pointer = {x: number; y: number};

export type DragAnchors = {
    offsetX: number;
    offsetY: number;
    prevX: number;
    prevY: number;
};

export function getDragAnchorsForShape(shape: Shape, pointer: Pointer, current: DragAnchors): DragAnchors {
    const {x, y} = pointer;

    if (shape.type === "rect" || shape.type === "rhombus") {
        return {
            ...current,
            offsetX: x - shape.x,
            offsetY: y - shape.y,
        };
    }

    if (shape.type === "circle") {
        return {
            ...current,
            offsetX: x - shape.centerX,
            offsetY: y - shape.centerY,
        };
    }

    if (shape.type === "line" || shape.type === "arrow" || shape.type === "freehand") {
        return {
            ...current,
            prevX: x,
            prevY: y,
        };
    }

    if (shape.type === "text") {
        return {
            ...current,
            offsetX: x - shape.x,
            offsetY: y - shape.y,
        };
    }

    return current;
}
