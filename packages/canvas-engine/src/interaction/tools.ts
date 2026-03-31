/**
 * Active drawing/interaction mode selected from toolbar or shortcuts.
 */
export type Tool = "select" | "rect" | "circle" | "line";

/**
 * Optional integration hooks so the host app can own tool state.
 */
export type AttachEventsOptions = {
    getTool?: () => Tool;
    onToolChange?: (tool: Tool) => void;
};
