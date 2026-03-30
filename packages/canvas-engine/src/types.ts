type BaseShape = {
    id: string;
    stroke?: string;
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
    | (BaseShape & {
          type: "line";
          x1: number;
          y1: number;
          x2: number;
          y2: number;
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
      };

/**
 * Handle represents all possible resize control points.
 *
 * Includes:
 * - box handles (rect / ellipse)
 * - line endpoints
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
