type BaseShape = {
    stroke?: string;
};

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
          radius: number;
      })
    | (BaseShape & {
          type: "line";
          x1: number;
          y1: number;
          x2: number;
          y2: number;
      });
