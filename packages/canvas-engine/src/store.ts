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

type ConnectorShape = Extract<Shape, {type: "line" | "arrow"}>;

function isConnectorShape(shape: Shape): shape is ConnectorShape {
    return shape.type === "line" || shape.type === "arrow";
}

function isBindableTarget(shape: Shape) {
    return shape.type !== "line" && shape.type !== "arrow";
}

function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
}

// Converts an absolute endpoint into normalized anchor space of a target shape.
function getRelativeBindingForPoint(shape: Shape, x: number, y: number) {
    const box = convertToPoints(shape);
    const width = Math.max(1, box.x2 - box.x1);
    const height = Math.max(1, box.y2 - box.y1);

    return {
        shapeId: shape.id,
        relX: clamp01((x - box.x1) / width),
        relY: clamp01((y - box.y1) / height),
    };
}

function getPointFromBinding(
    binding: ConnectorShape["startBinding"],
    shapeById: Map<string, Shape>
): {x: number; y: number} | null {
    if (!binding) return null;

    const target = shapeById.get(binding.shapeId);
    if (!target || !isBindableTarget(target)) return null;

    const box = convertToPoints(target);
    const width = box.x2 - box.x1;
    const height = box.y2 - box.y1;

    return {
        x: box.x1 + clamp01(binding.relX) * width,
        y: box.y1 + clamp01(binding.relY) * height,
    };
}

// Chooses the visually top-most candidate so endpoint attachment matches user intent.
function findTopBindableShapeAtPoint(shapes: Shape[], x: number, y: number, excludeId: string) {
    const SNAP_TOLERANCE = 10;

    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!shape || shape.id === excludeId || !isBindableTarget(shape)) continue;

        const box = convertToPoints(shape);
        const isInside =
            x >= box.x1 - SNAP_TOLERANCE &&
            x <= box.x2 + SNAP_TOLERANCE &&
            y >= box.y1 - SNAP_TOLERANCE &&
            y <= box.y2 + SNAP_TOLERANCE;

        if (isInside) return shape;
    }

    return null;
}

function attachConnectorBindings(connector: ConnectorShape, shapes: Shape[]): ConnectorShape {
    const startTarget = findTopBindableShapeAtPoint(shapes, connector.x1, connector.y1, connector.id);
    const endTarget = findTopBindableShapeAtPoint(shapes, connector.x2, connector.y2, connector.id);

    return {
        ...connector,
        startBinding: startTarget ? getRelativeBindingForPoint(startTarget, connector.x1, connector.y1) : undefined,
        endBinding: endTarget ? getRelativeBindingForPoint(endTarget, connector.x2, connector.y2) : undefined,
    };
}

function refreshBindingsForConnectorIds(shapes: Shape[], connectorIds: string[]) {
    if (connectorIds.length === 0) return shapes;

    const targetIds = new Set(connectorIds);

    return shapes.map((shape) => {
        if (!targetIds.has(shape.id) || !isConnectorShape(shape)) return shape;
        return attachConnectorBindings(shape, shapes);
    });
}

// Reprojects all currently bound connector endpoints using latest shape bounds.
function applyConnectorBindings(shapes: Shape[]) {
    const shapeById = new Map(shapes.map((shape) => [shape.id, shape] as const));

    return shapes.map((shape) => {
        if (!isConnectorShape(shape)) return shape;

        const startPoint = getPointFromBinding(shape.startBinding, shapeById);
        const endPoint = getPointFromBinding(shape.endBinding, shapeById);

        return {
            ...shape,
            x1: startPoint?.x ?? shape.x1,
            y1: startPoint?.y ?? shape.y1,
            x2: endPoint?.x ?? shape.x2,
            y2: endPoint?.y ?? shape.y2,
            startBinding: shape.startBinding && !startPoint ? undefined : shape.startBinding,
            endBinding: shape.endBinding && !endPoint ? undefined : shape.endBinding,
        };
    });
}

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
            let newShapes = [...shapes, action.payload];

            if (isConnectorShape(action.payload)) {
                newShapes = refreshBindingsForConnectorIds(newShapes, [action.payload.id]);
            }

            newShapes = applyConnectorBindings(newShapes);
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
            newShapes = refreshBindingsForConnectorIds(newShapes, [id]);
            newShapes = applyConnectorBindings(newShapes);

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

            newShapes = refreshBindingsForConnectorIds(newShapes, ids);
            newShapes = applyConnectorBindings(newShapes);

            state.setShapes(newShapes);
            break;
        }

        case "DELETE_SHAPES": {
            const selectedSet = new Set(action.payload.ids);
            const newShapes = applyConnectorBindings(shapes.filter((shape) => !selectedSet.has(shape.id)));
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

            newShapes = refreshBindingsForConnectorIds(newShapes, ids);
            newShapes = applyConnectorBindings(newShapes);

            state.setShapes(newShapes);
            break;
        }

        default:
            break;
    }
}
