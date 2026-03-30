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
- MOVE_SHAPE → existing shape updated (dragging)
*/
export type Action =
    | {type: "ADD_SHAPE"; payload: Shape}
    | {
          type: "MOVE_SHAPE";
          payload: {
              id: string;
              updates: Partial<Shape>;
          };
      };

/*
Dispatch function

Flow:
event → dispatch(action) → store updates state → render()

IMPORTANT:
- This is the ONLY place where state should change
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

        default:
            break;
    }
}
