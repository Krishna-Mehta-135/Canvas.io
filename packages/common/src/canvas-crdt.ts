import type { Shape } from "@repo/canvas-engine";

export const CANVAS_CRDT_PROP = "__crdt";

export type CanvasCrdtMetadata = {
  clock: number;
  clientId: string;
};

export type CanvasCrdtShape = Shape & {
  [CANVAS_CRDT_PROP]?: CanvasCrdtMetadata;
};

export type CanvasCrdtDeletion = {
  id: string;
  meta: CanvasCrdtMetadata;
};

export type CanvasCrdtMergeResult = {
  shapes: CanvasCrdtShape[];
  tombstones: Map<string, CanvasCrdtMetadata>;
};

const SERVER_BASE_META: CanvasCrdtMetadata = {
  clock: 0,
  clientId: "server",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMetadata(value: unknown): CanvasCrdtMetadata | null {
  if (!isPlainObject(value)) return null;

  const clock = value.clock;
  const clientId = value.clientId;

  if (
    typeof clock !== "number" ||
    !Number.isFinite(clock) ||
    typeof clientId !== "string"
  ) {
    return null;
  }

  return {
    clock: Math.max(0, Math.trunc(clock)),
    clientId,
  };
}

export function getCanvasCrdtMetadata(shape: Shape): CanvasCrdtMetadata {
  const meta = normalizeMetadata((shape as CanvasCrdtShape)[CANVAS_CRDT_PROP]);
  return meta ?? SERVER_BASE_META;
}

export function withCanvasCrdtMetadata(
  shape: Shape,
  meta: CanvasCrdtMetadata,
): CanvasCrdtShape {
  return {
    ...shape,
    [CANVAS_CRDT_PROP]: {
      clock: Math.max(0, Math.trunc(meta.clock)),
      clientId: meta.clientId,
    },
  } as CanvasCrdtShape;
}

export function compareCanvasCrdtMetadata(
  left: CanvasCrdtMetadata,
  right: CanvasCrdtMetadata,
) {
  if (left.clock !== right.clock) {
    return left.clock - right.clock;
  }

  return left.clientId.localeCompare(right.clientId);
}

export function isCanvasCrdtNewerOrEqual(
  incoming: CanvasCrdtMetadata,
  existing: CanvasCrdtMetadata,
) {
  return compareCanvasCrdtMetadata(incoming, existing) >= 0;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === CANVAS_CRDT_PROP) continue;
    output[key] = stableValue(value[key]);
  }

  return output;
}

export function getCanvasShapeContentHash(shape: Shape) {
  return JSON.stringify(stableValue(shape));
}

export function mergeCanvasCrdtSnapshot(
  currentShapes: Shape[],
  incomingShapes: Shape[],
  deletions: CanvasCrdtDeletion[] = [],
  currentTombstones: Map<string, CanvasCrdtMetadata> = new Map(),
): CanvasCrdtMergeResult {
  const merged = new Map<string, CanvasCrdtShape>();
  const tombstones = new Map(currentTombstones);

  for (const shape of currentShapes) {
    merged.set(
      shape.id,
      withCanvasCrdtMetadata(shape, getCanvasCrdtMetadata(shape)),
    );
  }

  for (const deletion of deletions) {
    const existingShape = merged.get(deletion.id);
    const existingMeta = existingShape
      ? getCanvasCrdtMetadata(existingShape)
      : tombstones.get(deletion.id);

    if (
      !existingMeta ||
      isCanvasCrdtNewerOrEqual(deletion.meta, existingMeta)
    ) {
      merged.delete(deletion.id);
      tombstones.set(deletion.id, deletion.meta);
    }
  }

  for (const shape of incomingShapes) {
    const incomingMeta = getCanvasCrdtMetadata(shape);
    const tombstoneMeta = tombstones.get(shape.id);
    if (
      tombstoneMeta &&
      isCanvasCrdtNewerOrEqual(tombstoneMeta, incomingMeta)
    ) {
      continue;
    }

    const existing = merged.get(shape.id);
    if (
      !existing ||
      isCanvasCrdtNewerOrEqual(incomingMeta, getCanvasCrdtMetadata(existing))
    ) {
      merged.set(shape.id, withCanvasCrdtMetadata(shape, incomingMeta));
      tombstones.delete(shape.id);
    }
  }

  return {
    shapes: Array.from(merged.values()),
    tombstones,
  };
}

export function reconcileLocalCanvasCrdtSnapshot(
  previousShapes: Shape[],
  nextShapes: Shape[],
  clientId: string,
  nextClock: () => number,
) {
  const previousById = new Map(
    previousShapes.map((shape) => [shape.id, shape]),
  );
  const nextIds = new Set(nextShapes.map((shape) => shape.id));
  const deletedShapeIds = previousShapes
    .filter((shape) => !nextIds.has(shape.id))
    .map((shape) => shape.id);

  const shapes = nextShapes.map((shape) => {
    const previous = previousById.get(shape.id);
    const contentChanged =
      !previous ||
      getCanvasShapeContentHash(previous) !== getCanvasShapeContentHash(shape);

    if (!contentChanged) {
      return withCanvasCrdtMetadata(shape, getCanvasCrdtMetadata(previous));
    }

    return withCanvasCrdtMetadata(shape, {
      clock: nextClock(),
      clientId,
    });
  });

  const deletionMeta =
    deletedShapeIds.length > 0
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
