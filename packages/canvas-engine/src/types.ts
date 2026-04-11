/*
types.ts

Core canvas-engine data contracts.

Contains:
- persisted shape model used by state/store
- preview shape model used during drag interactions
- handle union used for resize operations
*/

type BaseShape = {
    id: string;
    stroke?: string;
};

/**
 * Stores an endpoint anchor in normalized target-shape space.
 * relX/relY are in [0, 1] across the target's current bounding box.
 */
type EndpointBinding = {
    shapeId: string;
    relX: number;
    relY: number;
};

/**
 * Shared payload for connector-like shapes.
 * Bindings are optional so free endpoints remain supported.
 */
type ConnectorShape = BaseShape & {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    startBinding?: EndpointBinding;
    endBinding?: EndpointBinding;
};

// FINAL shape (stored in state)
export type Shape =
    | (BaseShape & {
          type: "rect";
          x: number;
          y: number;
          width: number;
          height: number;
      })
    | (BaseShape & {
          type: "circle";
          centerX: number;
          centerY: number;
          radiusX: number;
          radiusY: number;
      })
        | (ConnectorShape & {
                    type: "line";
            })
        | (ConnectorShape & {
                    type: "arrow";
            })
    | (BaseShape & {
        type: "text";
        x: number;
        y: number;
        text: string;
        fontSize: number;
        width: number;
        height: number;
        parentId?: string;
    })
    | (BaseShape & {
        type: "freehand";
        points: Array<{x: number; y: number}>;
      });

// preview shape (NO id)
export type PreviewShape =
    | {
          type: "rect";
          x: number;
          y: number;
          width: number;
          height: number;
      }
    | {
          type: "circle";
          centerX: number;
          centerY: number;
          radiusX: number;
          radiusY: number;
      }
    | {
          type: "line";
          x1: number;
          y1: number;
          x2: number;
          y2: number;
        }
        | {
            type: "arrow";
            x1: number;
            y1: number;
            x2: number;
            y2: number;
        }
        | {
            type: "freehand";
            points: Array<{x: number; y: number}>;
      };

/**
 * Handle represents all possible resize control points.
 *
 * Includes:
 * - box handles (rect / ellipse)
 * - connector endpoints (line / arrow)
 */
export type Handle =
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "start"
    | "end";
