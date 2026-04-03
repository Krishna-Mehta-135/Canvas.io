/*
Store (State Controller)

Purpose:
- Central place where ALL state updates happen
- Events DO NOT mutate shapes directly anymore
- Instead, events dispatch "actions"
- Store decides how to apply those changes

Why this exists:
- Prevent scattered mutations across codebase
- Make updates predictable and traceable
- Enable future features like undo/redo, websocket sync, persistence

Think of it as:
"Gatekeeper of all changes to the canvas state"
*/

import {CanvasState} from "./state";
import {Shape} from "./types";
import {convertToPoints} from "./geometry";

/*
Actions = description of WHAT happened (not HOW)

We keep it minimal for now:
- ADD_SHAPE → new shape created
- MOVE_SHAPE → one shape updated (dragging or resizing)
- MOVE_SHAPES → selected group moved together
*/
export type Action =
    | {type: "ADD_SHAPE"; payload: Shape}
    | {
          type: "DELETE_SHAPES";
          payload: {
              ids: string[];
          };
      }
    | {
          type: "MOVE_SHAPE";
          payload: {
              id: string;
              updates: Partial<Shape>;
          };
      }
    | {
          type: "MOVE_SHAPES";
          payload: {
              ids: string[];
              dx: number;
              dy: number;
          };
      }
    | {
          type: "NUDGE_SHAPES";
          payload: {
              ids: string[];
              dx: number;
              dy: number;
          };
      };

/*
Dispatch function

Flow:
event → dispatch(action) → store updates state → render()

IMPORTANT:
- This is the ONLY place where state should change
- Action handlers are pure shape transforms based on payload intent
*/
export function dispatch(state: CanvasState, action: Action) {
    const shapes = state.getShapes();

    const syncTextChildrenToParent = (
        prevShapes: Shape[],
        nextShapes: Shape[],
        parentId: string,
        skipIds: Set<string> = new Set()
    ) => {
        const prevParent = prevShapes.find((shape) => shape.id === parentId);
        const nextParent = nextShapes.find((shape) => shape.id === parentId);
        if (!prevParent || !nextParent) return nextShapes;

        // Compare parent bounds before/after action to move child text proportionally.
        const prevBox = convertToPoints(prevParent);
        const nextBox = convertToPoints(nextParent);

        const prevWidth = Math.max(1, prevBox.x2 - prevBox.x1);
        const prevHeight = Math.max(1, prevBox.y2 - prevBox.y1);
        const nextWidth = Math.max(1, nextBox.x2 - nextBox.x1);
        const nextHeight = Math.max(1, nextBox.y2 - nextBox.y1);

        return nextShapes.map((shape) => {
            if (shape.type !== "text") return shape;
            if (shape.parentId !== parentId) return shape;
            if (skipIds.has(shape.id)) return shape;

            // Store child text in normalized parent-space so transform propagation is shape-agnostic.
            const relX = (shape.x - prevBox.x1) / prevWidth;
            const relY = (shape.y - prevBox.y1) / prevHeight;
            const relWidth = shape.width / prevWidth;
            const relHeight = shape.height / prevHeight;

            const nextX = nextBox.x1 + relX * nextWidth;
            const nextY = nextBox.y1 + relY * nextHeight;
            const nextTextWidth = Math.max(8, relWidth * nextWidth);
            const nextTextHeight = Math.max(8, relHeight * nextHeight);
            // Scale font with resulting text box height for visual consistency.
            const fontScale = nextTextHeight / Math.max(1, shape.height);

            return {
                ...shape,
                x: nextX,
                y: nextY,
                width: nextTextWidth,
                height: nextTextHeight,
                fontSize: Math.max(8, shape.fontSize * fontScale),
            };
        });
    };

    switch (action.type) {
        case "ADD_SHAPE": {
            const newShapes = [...shapes, action.payload];
            state.setShapes(newShapes);
            break;
        }

        case "MOVE_SHAPE": {
            const {id, updates} = action.payload;

            let newShapes = shapes.map((s) => {
                if (s.id !== id) return s;

                return {
                    ...s,
                    ...updates,
                } as Shape;
            });

            newShapes = syncTextChildrenToParent(shapes, newShapes, id);

            state.setShapes(newShapes);
            break;
        }

        case "MOVE_SHAPES": {
            const {ids, dx, dy} = action.payload;
            const selectedSet = new Set(ids);

            let newShapes = shapes.map((shape) => {
                if (!selectedSet.has(shape.id)) return shape;

                if (shape.type === "rect") {
                    return {
                        ...shape,
                        x: shape.x + dx,
                        y: shape.y + dy,
                    };
                }

                if (shape.type === "circle") {
                    return {
                        ...shape,
                        centerX: shape.centerX + dx,
                        centerY: shape.centerY + dy,
                    };
                }

                if (shape.type === "text") {
                    return {
                        ...shape,
                        x: shape.x + dx,
                        y: shape.y + dy,
                    };
                }

                if (shape.type === "freehand") {
                    return {
                        ...shape,
                        points: shape.points.map((point) => ({
                            x: point.x + dx,
                            y: point.y + dy,
                        })),
                    };
                }

                return {
                    ...shape,
                    x1: shape.x1 + dx,
                    y1: shape.y1 + dy,
                    x2: shape.x2 + dx,
                    y2: shape.y2 + dy,
                };
            });

            for (const parentId of ids) {
                newShapes = syncTextChildrenToParent(shapes, newShapes, parentId, selectedSet);
            }

            state.setShapes(newShapes);
            break;
        }

        case "DELETE_SHAPES": {
            const selectedSet = new Set(action.payload.ids);
            const newShapes = shapes.filter((shape) => !selectedSet.has(shape.id));
            state.setShapes(newShapes);
            break;
        }

        case "NUDGE_SHAPES": {
            const {ids, dx, dy} = action.payload;
            const selectedSet = new Set(ids);

            let newShapes = shapes.map((shape) => {
                if (!selectedSet.has(shape.id)) return shape;

                if (shape.type === "rect") {
                    return {
                        ...shape,
                        x: shape.x + dx,
                        y: shape.y + dy,
                    };
                }

                if (shape.type === "circle") {
                    return {
                        ...shape,
                        centerX: shape.centerX + dx,
                        centerY: shape.centerY + dy,
                    };
                }

                if (shape.type === "text") {
                    return {
                        ...shape,
                        x: shape.x + dx,
                        y: shape.y + dy,
                    };
                }

                if (shape.type === "freehand") {
                    return {
                        ...shape,
                        points: shape.points.map((point) => ({
                            x: point.x + dx,
                            y: point.y + dy,
                        })),
                    };
                }

                return {
                    ...shape,
                    x1: shape.x1 + dx,
                    y1: shape.y1 + dy,
                    x2: shape.x2 + dx,
                    y2: shape.y2 + dy,
                };
            });

            for (const parentId of ids) {
                newShapes = syncTextChildrenToParent(shapes, newShapes, parentId, selectedSet);
            }

            state.setShapes(newShapes);
            break;
        }

        default:
            break;
    }
}
