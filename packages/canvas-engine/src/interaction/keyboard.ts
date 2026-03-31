import {Tool} from "./tools";

type KeyboardCallbacks = {
    updateTool: (tool: Tool) => void;
    hasSelection: () => boolean;
    deleteSelection: () => void;
    nudgeSelection: (dx: number, dy: number) => void;
    undo: () => void;
    redo: () => void;
};

/**
 * Handles global editor keyboard shortcuts and returns true when consumed.
 */
export function handleGlobalKeydown(event: KeyboardEvent, callbacks: KeyboardCallbacks) {
    const {updateTool, hasSelection, deleteSelection, nudgeSelection, undo, redo} = callbacks;

    if (event.key === "v" || event.key === "V") {
        updateTool("select");
        return true;
    }
    if (event.key === "1") {
        updateTool("rect");
        return true;
    }
    if (event.key === "2") {
        updateTool("circle");
        return true;
    }
    if (event.key === "3") {
        updateTool("line");
        return true;
    }
    if (event.key === "4") {
        updateTool("text");
        return true;
    }
    if (event.key === "5") {
        updateTool("freehand");
        return true;
    }

    if (hasSelection() && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        deleteSelection();
        return true;
    }

    if (hasSelection()) {
        const nudgeStep = event.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;

        if (event.key === "ArrowLeft") dx = -nudgeStep;
        if (event.key === "ArrowRight") dx = nudgeStep;
        if (event.key === "ArrowUp") dy = -nudgeStep;
        if (event.key === "ArrowDown") dy = nudgeStep;

        if (dx !== 0 || dy !== 0) {
            event.preventDefault();
            nudgeSelection(dx, dy);
            return true;
        }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        undo();
        return true;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "y") {
        event.preventDefault();
        redo();
        return true;
    }

    return false;
}
