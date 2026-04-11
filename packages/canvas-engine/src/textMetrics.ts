import {Shape} from "./types";
import {getWrappedTextLines} from "./textLayout";

export function getFittedTextFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxHeight: number,
    preferredFontSize: number
) {
    const minFontSize = 8;
    const width = Math.max(8, maxWidth);
    const height = Math.max(8, maxHeight);
    let fontSize = Math.max(minFontSize, preferredFontSize);

    while (fontSize > minFontSize) {
        ctx.font = `${fontSize}px Virgil, Caveat, ui-rounded, sans-serif`;
        const wrappedLines = getWrappedTextLines(ctx, text, width);
        const lineHeight = fontSize * 1.25;

        if (wrappedLines.length * lineHeight <= height) {
            break;
        }

        fontSize -= 0.5;
    }

    return Math.max(minFontSize, fontSize);
}

export function getTextRenderMetrics(ctx: CanvasRenderingContext2D, shape: Extract<Shape, {type: "text"}>) {
    const fittedFontSize = getFittedTextFontSize(ctx, shape.text, shape.width, shape.height, shape.fontSize);
    ctx.font = `${fittedFontSize}px Virgil, Caveat, ui-rounded, sans-serif`;

    const lineHeight = fittedFontSize * 1.25;
    const wrappedLines = getWrappedTextLines(ctx, shape.text, shape.width);
    const maxY = shape.y + Math.max(8, shape.height);

    const visibleLines: string[] = [];
    let maxLineWidth = 0;

    for (let index = 0; index < wrappedLines.length; index++) {
        const line = wrappedLines[index];
        if (line === undefined) continue;

        const y = shape.y + index * lineHeight;
        if (y + lineHeight > maxY) break;

        visibleLines.push(line);
        maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
    }

    const textWidth = Math.min(Math.max(8, shape.width), Math.max(8, maxLineWidth));
    const textHeight = Math.min(Math.max(8, shape.height), Math.max(8, visibleLines.length * lineHeight));

    return {
        fittedFontSize,
        lineHeight,
        visibleLines,
        textWidth,
        textHeight,
    };
}
