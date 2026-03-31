/**
 * Active drawing/interaction mode selected from toolbar or shortcuts.
 */
export type Tool = "select" | "rect" | "circle" | "line" | "text" | "freehand";

/**
 * Tools that currently create geometry via drag interactions.
 */
export function isDrawableTool(tool: Tool): tool is "rect" | "circle" | "line" {
    return tool === "rect" || tool === "circle" || tool === "line";
}

/**
 * Optional integration hooks so the host app can own tool state.
 */
export type AttachEventsOptions = {
    getTool?: () => Tool;
    onToolChange?: (tool: Tool) => void;
};
