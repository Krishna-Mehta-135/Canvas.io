# Canvas Engine Structure

This package is split by responsibility to keep interaction logic isolated from rendering/state primitives.

## Top-level source files

- src/index.ts
  - Public package exports used by other apps.
- src/events.ts
  - Main event coordinator. Routes mouse/keyboard input to drag, resize, select, or draw flows.
- src/renderer.ts
  - Pure drawing layer. Renders shapes, selection outlines, handles, and marquee box.
- src/store.ts
  - State transition controller. Applies actions (add shape, move one shape, move selected group).
- src/state.ts
  - Undo/redo snapshot store for shape arrays.
- src/types.ts
  - Shape and handle type definitions.
- src/geometry.ts
  - Pure resize/box conversion math.
- src/hitDetection.ts
  - Shape hit-testing and resize-handle hit-testing.
- src/utils.ts
  - Shared canvas utility helpers (for example, mouse position translation).

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

## Why this layout

- Keeps src/events.ts focused on orchestration, not math or mapping logic.
- Makes interaction helpers independently testable.
- Reduces top-level file noise by grouping related event helper modules.
