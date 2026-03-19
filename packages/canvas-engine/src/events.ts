/*
Responsibilities of events.ts :-
1. Listen to mouse events
2. Manage interaction state
3. Update CanvasState when needed
4. Call render()
*/

import {render} from "./renderer";
import {Shape} from "./types";
import {getMousePos} from "./utils";
import {CanvasState} from "./state";

type Tool = "rect" | "circle" | "line";

function createPreviewShape(tool: Tool, startX: number, startY: number, currentX: number, currentY: number): Shape {
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
        const radius = Math.sqrt((currentX - startX) ** 2 + (currentY - startY) ** 2);

        return {
            type: "circle",
            centerX: startX,
            centerY: startY,
            radius,
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

//User must make the shape at least 3px to create a shape, anyless than 3px wont be considered a shape and will be discarded.
function hasDragged(startX: number, startY: number, endX: number, endY: number) {
    const dx = endX - startX;
    const dy = endY - startY;

    //Calculating distance using manhattan distance
    return dx * dx + dy * dy > 9 // (3px)^2;
}

export function attachEvents(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, state: CanvasState) {
    let isDrawing = false;
    let startX = 0;
    let startY = 0;

    let previewShape: Shape | null = null;

    let currentTool: Tool = "rect"; // later comes from UI
    let activeTool: Tool | null = null;

    //MouseDown
    canvas.addEventListener("mousedown", (e) => {
        const {x, y} = getMousePos(canvas, e);

        activeTool = currentTool;
        isDrawing = true;
        startX = x;
        startY = y;
    });

    //MouseMove
    canvas.addEventListener("mousemove", (e) => {
        if (!isDrawing) return;

        const {x, y} = getMousePos(canvas, e);

        //create preview(Not store in state)
        if (!activeTool) return;
        previewShape = createPreviewShape(activeTool, startX, startY, x, y);

        const shapes = state.getShapes();
        render(ctx, canvas, previewShape ? [...shapes, previewShape] : shapes);
    });

    //MouseUp
    canvas.addEventListener("mouseup", (e) => {
        if (!isDrawing || !activeTool) return;

        const {x, y} = getMousePos(canvas, e);

        //check if user actually dragged
        if (!hasDragged(startX, startY, x, y)) {
            isDrawing = false;
            activeTool = null;
            previewShape = null;

            render(ctx, canvas, state.getShapes());
            return;
        }

        const finalShape = createPreviewShape(activeTool, startX, startY, x, y);

        state.addShape(finalShape);

        isDrawing = false;
        activeTool = null;
        previewShape = null;

        render(ctx, canvas, state.getShapes());
    });
}
