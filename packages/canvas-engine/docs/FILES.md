# File Reference

This is a quick reference for required canvas engine files and what each one owns.

## Core API

- src/index.ts
  - Exports attachEvents, CanvasState, Shape, Tool.

## Interaction entry

- src/events.ts
  - Keyboard tool switching and undo/redo shortcuts.
  - Mouse down/move/up lifecycle.
  - Drag one shape and drag selected group.
  - Resize flow dispatch.
  - Selection marquee lifecycle.

## Interaction helpers

- src/interaction/tools.ts
  - Tool and AttachEventsOptions types.
- src/interaction/preview.ts
  - createPreviewShape(tool, startX, startY, currentX, currentY).
- src/interaction/cursor.ts
  - getCursorForHandle(handle).
- src/interaction/resizeTarget.ts
  - getResizeTarget(shapes, x, y, selectedShape, padding).
- src/interaction/selection.ts
  - hasDragged(...)
  - getSelectionBox(...)
  - isShapeInsideBox(shape, box)
  - getSelectedShapesByIds(shapes, ids)

## Rendering + geometry

- src/renderer.ts
  - Draw map by shape type, selection overlays, marquee rendering.
- src/geometry.ts
  - convertToPoints, normalize, convertBackToShape, resizeShape.

## Hit + state

- src/hitDetection.ts
  - getShapeAtPoint, getHandleAtPoint.
- src/store.ts
  - dispatch(action) reducer-like transitions.
- src/state.ts
  - present/past/future snapshots with undo/redo.

## Shared types + utils

- src/types.ts
  - Shape union, PreviewShape union, Handle union.
- src/utils.ts
  - Canvas helper utilities.
