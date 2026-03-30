/*
CanvasState

Stores shapes AND their history.

We keep:
- past    → previous states (for undo)
- present → current state
- future  → undone states (for redo)

IMPORTANT:
- Each state is a full snapshot (Shape[])
- No mutation allowed outside this class
*/

import { Shape } from "./types";

export class CanvasState {
    private past: Shape[][] = [];
    private present: Shape[] = [];
    private future: Shape[][] = [];

    getShapes() {
        return this.present;
    }

    /**
     * Apply a new state.
     * - push current → past
     * - replace present
     * - clear future (redo invalidated)
     */
    setShapes(newShapes: Shape[]) {
        this.past.push(this.present);
        this.present = newShapes;
        this.future = [];
    }

    /**
     * Undo:
     * move one step back in history
     */
    undo() {
        if (this.past.length === 0) return;

        const prev = this.past.pop()!;
        this.future.push(this.present);
        this.present = prev;
    }

    /**
     * Redo:
     * move one step forward
     */
    redo() {
        if (this.future.length === 0) return;

        const next = this.future.pop()!;
        this.past.push(this.present);
        this.present = next;
    }
}