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
    /**
     * Pub-sub listeners.
     *
     * Important:
     * - Shapes are NOT subscribers.
     * - A listener is a callback function owned by outside code (e.g. app layer).
     * - We pass Shape[] to listeners as event payload data.
     */
    private listeners = new Set<(shapes: Shape[]) => void>();

    private notifyChange() {
        for (const listener of this.listeners) {
            listener([...this.present]);
        }
    }

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
        this.notifyChange();
    }

    /**
     * Hydrate state from persistence without affecting undo/redo history.
     */
    hydrateShapes(shapes: Shape[]) {
        this.past = [];
        this.present = shapes;
        this.future = [];
        this.notifyChange();
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
        this.notifyChange();
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
        this.notifyChange();
    }

    /**
     * Subscribe to state changes.
     *
     * Returns an unsubscribe function to stop receiving updates.
     * Call this on component cleanup to avoid duplicate listeners/memory leaks.
     */
    subscribe(listener: (shapes: Shape[]) => void) {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }
}