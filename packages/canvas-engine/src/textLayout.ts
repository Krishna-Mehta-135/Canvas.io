/*
textLayout.ts

Shared helpers for wrapping canvas text inside a target width.
*/

export function getWrappedTextLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] {
    const width = Math.max(8, maxWidth);
    const rawLines = text.split("\n");
    const wrapped: string[] = [];

    const wrapSingleLine = (line: string) => {
        if (line.length === 0) {
            wrapped.push("");
            return;
        }

        let current = "";

        for (const ch of line) {
            const candidate = current + ch;

            // Character-level wrapping keeps behavior predictable for long tokens without spaces.
            if (current.length > 0 && ctx.measureText(candidate).width > width) {
                wrapped.push(current);
                current = ch;
            } else {
                current = candidate;
            }
        }

        wrapped.push(current);
    };

    rawLines.forEach(wrapSingleLine);

    return wrapped;
}