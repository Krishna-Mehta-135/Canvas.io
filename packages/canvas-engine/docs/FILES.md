# File Reference

This is a quick reference for required canvas engine files and what each one owns.

## Core API

- src/index.ts
  - Exports attachEvents, CanvasState, Shape, Tool, AttachEventsController.

## Interaction entry

- src/events.ts
  - Keyboard tool switching, delete/nudge, and undo/redo shortcuts.
  - Mouse down/move/up lifecycle with priority: resize > drag > draw.
  - Single and multi-drag support.
  - Multi-selection can be dragged by clicking any empty area inside its selection bounds.
  - Text tool inline edit flow and live wrapped preview.
  - Text insertion supports binding text to clicked parent shape.
  - Arrow connectors are handled using the same drag/resize endpoint flow as line shapes.
  - Auto-resets active tool back to select after completed text/draw/freehand actions.

## Interaction helpers

- src/interaction/tools.ts
  - Tool, AttachEventsOptions, and AttachEventsController types.
  - Drawable tools include rect, circle, line, and arrow.
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
- src/interaction/keyboard.ts
  - handleGlobalKeydown(event, callbacks) shortcut dispatcher.
  - Includes `A` shortcut for arrow tool.
- src/interaction/textEditor.ts
  - createInlineTextEditor(...) for inline canvas text editing.
- src/interaction/hitDetection.ts
  - getShapeAtPoint and getHandleAtPoint for selection/resize targeting.
  - Line and arrow share connector hit-testing and endpoint handles.

## Rendering + geometry

- src/renderer.ts
  - Draw map by shape type, selection overlays, marquee rendering.
  - Arrow rendering includes dynamic arrowhead geometry.
  - Text rendering uses width-based wrapping via shared text layout helper.
- src/geometry.ts
  - convertToPoints, normalize, convertBackToShape, resizeShape.
  - Text resize allows width downsizing so content reflows onto next lines.
- src/textLayout.ts
  - getWrappedTextLines(ctx, text, maxWidth) shared wrapping helper.

## Hit + state

- src/store.ts
  - dispatch(action) reducer-like transitions.
  - Parent-child transform sync: child text follows parent move/resize/nudge.
  - Connector endpoint binding sync: line/arrow endpoints can attach to non-connector shapes and follow their transforms.
- src/state.ts
  - present/past/future snapshots with undo/redo.

## Shared types + utils

- src/types.ts
  - Shape union, PreviewShape union, Handle union.
  - Connector shapes (`line`, `arrow`) include optional endpoint binding metadata.
  - Text shape supports optional parentId for containment binding.
- src/utils.ts
  - Canvas helper utilities.
