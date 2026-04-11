# Canvas Engine Structure

This package is split by responsibility to keep interaction logic isolated from rendering/state primitives.

## Current interaction model

- Selection:
  - Click to select one shape.
  - Shift+click toggles shape membership in current selection.
  - Marquee drag selects fully enclosed shapes.
  - Multi-selection can be dragged by clicking either a selected shape OR empty space inside the selection bounds.
- Keyboard:
  - Tool switching shortcuts.
  - `A` shortcut switches to arrow connector tool.
  - Delete/backspace removal.
  - Arrow nudging (shift for larger step).
  - Undo/redo dispatch.
- Connectors (line + arrow):
  - Endpoint drag/resize uses shared connector logic.
  - Endpoints can bind to nearby non-connector shapes.
  - Bound endpoints recompute from relative anchors when target shapes move/resize.
- Text:
  - Inline canvas editing with live wrapped preview.
  - Text can be parent-bound to clicked shapes (`parentId`).
  - Parent move/resize/nudge propagates to child text.
  - Text wraps by width and reflows during resize.
  - After text/draw/freehand completion, active tool resets to select.

## Top-level source files

- src/index.ts
  - Public package exports used by other apps.
- src/events.ts
  - Main event coordinator. Routes mouse/keyboard input to drag, resize, select, draw, and text flows.
- src/renderer.ts
  - Pure drawing layer. Renders shapes, wrapped text, selection outlines, handles, and marquee box.
  - Arrow draw path includes computed arrowhead wings.
- src/store.ts
  - State transition controller. Applies actions, connector binding sync, and parent-child text propagation updates.
- src/state.ts
  - Undo/redo snapshot store for shape arrays.
- src/types.ts
  - Shape and handle type definitions, including connector endpoint bindings and optional text `parentId`.
- src/geometry.ts
  - Pure resize/box conversion math, including text resize/reflow behavior.
- src/interaction/hitDetection.ts
  - Shape hit-testing and resize-handle hit-testing.
- src/utils.ts
  - Shared canvas utility helpers (for example, mouse position translation).
- src/textLayout.ts
  - Shared width-based text wrapping helper used by render and text preview.

## Interaction helpers (moved under folder)

- src/interaction/tools.ts
  - Tool mode types and attach-event options contract.
- src/interaction/preview.ts
  - Preview shape generation while drawing.
- src/interaction/cursor.ts
  - Cursor mapping for each handle type.
- src/interaction/resizeTarget.ts
  - Resolve top-most resize target with selected-shape priority.
- src/interaction/selection.ts
  - Marquee selection math and selected-id helpers.
- src/interaction/keyboard.ts
  - Global keyboard shortcut dispatching.
- src/interaction/textEditor.ts
  - Inline text editor lifecycle over canvas.

## Why this layout

- Keeps src/events.ts focused on orchestration, not math or mapping logic.
- Makes interaction helpers independently testable.
- Reduces top-level file noise by grouping related event helper modules.
- Allows text layout and parent-child sync to remain shared and deterministic across render, preview, and store updates.
