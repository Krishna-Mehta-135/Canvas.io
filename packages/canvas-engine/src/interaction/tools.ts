/**
 * Active drawing/interaction mode selected from toolbar or shortcuts.
 */
export type Tool = "select" | "rect" | "circle" | "rhombus" | "line" | "arrow" | "text" | "freehand" | "eraser";

/**
 * Tools that currently create geometry via drag interactions.
 */
export function isDrawableTool(tool: Tool): tool is "rect" | "circle" | "rhombus" | "line" | "arrow" {
    return tool === "rect" || tool === "circle" || tool === "rhombus" || tool === "line" || tool === "arrow";
}

/**
 * Optional integration hooks so the host app can own tool state.
 */
export type AttachEventsOptions = {
    getTool?: () => Tool;
    onToolChange?: (tool: Tool) => void;
    onSelectionChange?: (selectedIds: string[]) => void;
    initialViewport?: import("../utils").Viewport;
    onViewportChange?: (viewport: import("../utils").Viewport) => void;
};

/**
 * Imperative controls exposed by attachEvents for host UI integrations.
 */
export type AttachEventsController = {
    deleteSelection: () => void;
    hasSelection: () => boolean;
    getSelectedIds: () => string[];
    rerender: () => void;
    replayShape: (shapeId: string) => void;
};
