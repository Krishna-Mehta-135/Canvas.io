# Architecture Deep Dive: Canvas Engine & Rendering Loop

## Summary
The `canvas-engine` is a standalone, vanilla TypeScript rendering library designed to power high-performance, interactive whiteboards. It intentionally avoids dependency on React's rendering lifecycle to achieve consistent 60+ FPS performance even under heavy load.

## Intent & Expectations
A collaborative whiteboard must feel "alive." Every mouse movement should reflect instantly on the screen without stuttering. Our intent was to:
1.  **Eliminate Rendering Jitter:** React's reconciliation process can take several milliseconds when managing thousands of virtual DOM nodes. On a canvas, where every frame counts, this jitter is visible.
2.  **Decouple UI from Logic:** The engine should be able to run in any environment (web, electron, or even headless for automated testing/export).
3.  **Support High Shape Counts:** Users should be able to draw complex diagrams with thousands of elements without the UI becoming unresponsive.

## The Approach: Immediate Mode Rendering

We built the engine using an **Immediate Mode Rendering** model on the HTML5 Canvas API.

### 1. The Store (`store.ts`)
We implemented a custom, lightweight state store.
*   **Flattened State:** Shapes are stored in a `Map<string, Shape>` for $O(1)$ lookups and updates.
*   **Action-Based Updates:** All mutations (moving, resizing, deleting) happen through `dispatch` calls. This makes the state changes predictable and enables future features like Undo/Redo.
*   **Viewport Management:** The store tracks `zoom` and `offset`, allowing users to pan and zoom across an infinite canvas.

### 2. The Rendering Loop (`renderer.ts`)
The engine uses a Request Animation Frame (RAF) loop. In every frame, it executes the following pipeline:
1.  **Clear:** Wipe the entire canvas.
2.  **Grid:** Draw the background grid (if enabled) adjusted for current zoom/pan.
3.  **Shapes:** Iterate through all shapes in z-index order and draw them.
4.  **Selection:** Draw the "Active Selection" UI (bounding boxes, resize handles).
5.  **Multi-user Presence:** Draw the cursors and selections of other collaborators.

### 3. RoughJS & Aesthetics
To achieve a "sketchy," hand-drawn feel, we utilize **RoughJS**.
*   **Caching:** Since RoughJS calculations are expensive, we cache the pre-generated `RoughSet` for each shape.
*   **Invalidation:** The cache is only cleared if the shape's properties (width, height, roughness) actually change.

### 4. Interaction & Hit Detection
Since Canvas is a flat raster, we manually calculate which shape the user is interacting with.
*   **Geometry Path Math:** We use mathematical functions (e.g., `pointInRectangle`, `pointOnLineWithTolerance`) to determine selection.
*   **Z-Index Priority:** When shapes overlap, the hit detection algorithm always selects the shape with the highest z-index.

## Interaction Tools (`interaction/tools.ts`)
The engine provides a controller-based API for the host application (Next.js):
*   **`AttachEventsController`**: Exposes imperative methods like `deleteSelection()`, `setViewport()`, and `focusViewportToBounds()`.
*   **Active Tools**: Supports `select`, `rect`, `circle`, `rhombus`, `line`, `arrow`, `text`, `freehand`, and `eraser`.

## Why this approach? (Rationale)

*   **Why not React Components?** In a typical React app, if you drag a shape, React might re-render a significant part of the tree. With 1,000 shapes, that's 1,000 components checking for props changes. The overhead is too high for 120Hz interaction.
*   **Why not SVG?** SVG is DOM-based. Each shape is a DOM node. Browsers struggle with 3,000+ DOM nodes, leading to slow layout passes.

**The Canvas Winner:** By using the raw Canvas API, we bypassed the browser's DOM/Reconciliation overhead entirely, giving us full control over every pixel and every microsecond of execution.

## Trade-offs
*   **Accessibility:** Canvas is a black box to screen readers. We must maintain a separate "hidden" DOM layer to describe the canvas content to users with visual impairments.
*   **Complexity:** We had to re-implement basic browser behaviors like "text selection" and "hover states" manually.

## Future Considerations
To support even larger canvases, we plan to implement **Spatial Partitioning (Quadtrees)**. This will allow the engine to skip the drawing of shapes that are currently outside the user's viewport, further reducing the work per frame from $O(N)$ to $O(\log N)$.
