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

    switch (action.type) {
        case "ADD_SHAPE": {
            const newShapes = [...shapes, action.payload];
            state.setShapes(newShapes);
            break;
        }

        case "MOVE_SHAPE": {
            const {id, updates} = action.payload;

            const newShapes = shapes.map((s) => {
                if (s.id !== id) return s;

                return {
                    ...s,
                    ...updates,
                } as Shape;
            });

            state.setShapes(newShapes);
            break;
        }

        case "MOVE_SHAPES": {
            const {ids, dx, dy} = action.payload;
            const selectedSet = new Set(ids);

            const newShapes = shapes.map((shape) => {
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

                return {
                    ...shape,
                    x1: shape.x1 + dx,
                    y1: shape.y1 + dy,
                    x2: shape.x2 + dx,
                    y2: shape.y2 + dy,
                };
            });

            state.setShapes(newShapes);
            break;
        }

        default:
            break;
    }
}
