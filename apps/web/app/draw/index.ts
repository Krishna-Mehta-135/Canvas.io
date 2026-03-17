type Shape =
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
          radius: number;
      };

export function initDraw(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");

    let existingShapes: Shape[] = [];

    if (!ctx) return;
    let clicked = false;

    let startX = 0;
    let startY = 0;

    canvas.addEventListener("mousedown", (e) => {
        const rect = canvas.getBoundingClientRect();
        clicked = true;
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
    });

    canvas.addEventListener("mouseup", (e) => {
        const rect = canvas.getBoundingClientRect();
        clicked = false;

        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        const width = endX - startX;
        const height = endY - startY;

        existingShapes.push({
            type: "rect",
            x: startX,
            y: startY,
            width,
            height,
        });

        clearCanvas(existingShapes, canvas, ctx);
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!clicked) return;

        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - startX;
        const height = currentY - startY;

        clearCanvas(existingShapes, canvas, ctx);

        ctx.strokeStyle = "white";
        ctx.strokeRect(startX, startY, width, height);
    });
}

function clearCanvas(existingShapes: Shape[], canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    existingShapes.map((shape) => {
        if (shape.type === "rect") {
            ctx.strokeStyle = "white";
            ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }
    });
}
