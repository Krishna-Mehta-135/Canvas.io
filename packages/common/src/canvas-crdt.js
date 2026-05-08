export const CANVAS_CRDT_PROP = "__crdt";
const SERVER_BASE_META = {
    clock: 0,
    clientId: "server",
};
function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizeMetadata(value) {
    if (!isPlainObject(value))
        return null;
    const clock = value.clock;
    const clientId = value.clientId;
    if (typeof clock !== "number" ||
        !Number.isFinite(clock) ||
        typeof clientId !== "string") {
        return null;
    }
    return {
        clock: Math.max(0, Math.trunc(clock)),
        clientId,
    };
}
export function getCanvasCrdtMetadata(shape) {
    const meta = normalizeMetadata(shape[CANVAS_CRDT_PROP]);
    return meta ?? SERVER_BASE_META;
}
export function withCanvasCrdtMetadata(shape, meta) {
    return {
        ...shape,
        [CANVAS_CRDT_PROP]: {
            clock: Math.max(0, Math.trunc(meta.clock)),
            clientId: meta.clientId,
        },
    };
}
export function compareCanvasCrdtMetadata(left, right) {
    if (left.clock !== right.clock) {
        return left.clock - right.clock;
    }
    return left.clientId.localeCompare(right.clientId);
}
export function isCanvasCrdtNewerOrEqual(incoming, existing) {
    return compareCanvasCrdtMetadata(incoming, existing) >= 0;
}
function stableValue(value) {
    if (Array.isArray(value)) {
        return value.map(stableValue);
    }
    if (!isPlainObject(value)) {
        return value;
    }
    const output = {};
    for (const key of Object.keys(value).sort()) {
        if (key === CANVAS_CRDT_PROP)
            continue;
        output[key] = stableValue(value[key]);
    }
    return output;
}
export function getCanvasShapeContentHash(shape) {
    return JSON.stringify(stableValue(shape));
}
export function mergeCanvasCrdtSnapshot(currentShapes, incomingShapes, deletions = [], currentTombstones = new Map()) {
    const merged = new Map();
    const tombstones = new Map(currentTombstones);
    for (const shape of currentShapes) {
        merged.set(shape.id, withCanvasCrdtMetadata(shape, getCanvasCrdtMetadata(shape)));
    }
    for (const deletion of deletions) {
        const existingShape = merged.get(deletion.id);
        const existingMeta = existingShape
            ? getCanvasCrdtMetadata(existingShape)
            : tombstones.get(deletion.id);
        if (!existingMeta ||
            isCanvasCrdtNewerOrEqual(deletion.meta, existingMeta)) {
            merged.delete(deletion.id);
            tombstones.set(deletion.id, deletion.meta);
        }
    }
    for (const shape of incomingShapes) {
        const incomingMeta = getCanvasCrdtMetadata(shape);
        const tombstoneMeta = tombstones.get(shape.id);
        if (tombstoneMeta &&
            isCanvasCrdtNewerOrEqual(tombstoneMeta, incomingMeta)) {
            continue;
        }
        const existing = merged.get(shape.id);
        if (!existing ||
            isCanvasCrdtNewerOrEqual(incomingMeta, getCanvasCrdtMetadata(existing))) {
            merged.set(shape.id, withCanvasCrdtMetadata(shape, incomingMeta));
            tombstones.delete(shape.id);
        }
    }
    return {
        shapes: Array.from(merged.values()),
        tombstones,
    };
}
export function reconcileLocalCanvasCrdtSnapshot(previousShapes, nextShapes, clientId, nextClock) {
    const previousById = new Map(previousShapes.map((shape) => [shape.id, shape]));
    const nextIds = new Set(nextShapes.map((shape) => shape.id));
    const deletedShapeIds = previousShapes
        .filter((shape) => !nextIds.has(shape.id))
        .map((shape) => shape.id);
    const shapes = nextShapes.map((shape) => {
        const previous = previousById.get(shape.id);
        const contentChanged = !previous ||
            getCanvasShapeContentHash(previous) !== getCanvasShapeContentHash(shape);
        if (!contentChanged) {
            return withCanvasCrdtMetadata(shape, getCanvasCrdtMetadata(previous));
        }
        return withCanvasCrdtMetadata(shape, {
            clock: nextClock(),
            clientId,
        });
    });
    const deletionMeta = deletedShapeIds.length > 0
        ? {
            clock: nextClock(),
            clientId,
        }
        : null;
    return {
        shapes,
        deletedShapeIds,
        deletionMeta,
    };
}
