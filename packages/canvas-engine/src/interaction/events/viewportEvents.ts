import { Viewport, clamp, getMousePos, screenToWorldPoint } from "../../utils";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  resizeCanvasForViewport,
  WHEEL_PAN_SENSITIVITY,
  WHEEL_ZOOM_SENSITIVITY,
} from "./eventHelpers";

type AttachViewportEventsParams = {
  canvas: HTMLCanvasElement;
  getViewport: () => Viewport;
  setViewport: (nextViewport: Viewport) => void;
  setLastPointer: (point: { x: number; y: number }) => void;
  updateCursor: () => void;
  renderScene: () => void;
  isInteractionActive: () => boolean;
  shouldRepaintOnReset: () => boolean;
  resetInteractions: () => void;
  resetToSelectTool: () => void;
  releaseSpacePan: () => void;
};

export function attachViewportEvents(params: AttachViewportEventsParams) {
  const {
    canvas,
    getViewport,
    setViewport,
    setLastPointer,
    updateCursor,
    renderScene,
    isInteractionActive,
    shouldRepaintOnReset,
    resetInteractions,
    resetToSelectTool,
    releaseSpacePan,
  } = params;

  let renderRaf: number | null = null;
  const requestRender = () => {
    if (renderRaf !== null) return;
    renderRaf = requestAnimationFrame(() => {
      renderRaf = null;
      renderScene();
    });
  };

  const handleWindowMouseUp = () => {
    if (!isInteractionActive()) {
      return;
    }

    // If the pointer is released outside the canvas, the canvas never receives mouseup.
    // Clear transient interaction state here so selected shapes don't keep tracking the cursor.
    const shouldRepaint = shouldRepaintOnReset();
    resetInteractions();
    resetToSelectTool();
    updateCursor();

    if (shouldRepaint) {
      renderScene();
    }
  };

  const handleWindowBlur = () => {
    if (!isInteractionActive()) {
      return;
    }

    resetInteractions();
    resetToSelectTool();
    updateCursor();
    renderScene();
  };

  const handleWindowKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      releaseSpacePan();
      updateCursor();
    }
  };

  const handleWindowResize = () => {
    const previousWidth = canvas.width;
    const previousHeight = canvas.height;
    const { width, height, pixelRatio } = resizeCanvasForViewport(canvas);

    if (previousWidth > 0 && previousHeight > 0) {
      const viewport = getViewport();
      const previousCssWidth = previousWidth / pixelRatio;
      const previousCssHeight = previousHeight / pixelRatio;
      setViewport({
        ...viewport,
        x: viewport.x + (width - previousCssWidth) / 2,
        y: viewport.y + (height - previousCssHeight) / 2,
      });
    }

    requestRender();
  };

  let isGesturing = false;
  let initialPinchZoom = 1;
  let gesturePointer = { x: 0, y: 0 };

  const handleGestureStart = (e: Event) => {
    e.preventDefault();
    isGesturing = true;
    initialPinchZoom = getViewport().scale;

    // Safari GestureEvent has clientX/clientY but weak typing
    const ge = e as unknown as { scale?: unknown };
    gesturePointer = getMousePos(canvas, e as unknown as MouseEvent);
    setLastPointer(gesturePointer);
  };

  const handleGestureChange = (e: Event) => {
    e.preventDefault();
    const ge = e as unknown as { scale: number };

    const viewport = getViewport();
    const worldPoint = screenToWorldPoint(gesturePointer, viewport);
    const nextScale = clamp(initialPinchZoom * ge.scale, MIN_ZOOM, MAX_ZOOM);

    setViewport({
      scale: nextScale,
      x: gesturePointer.x - worldPoint.x * nextScale,
      y: gesturePointer.y - worldPoint.y * nextScale,
    });

    updateCursor();
    requestRender();
  };

  const handleGestureEnd = (e: Event) => {
    e.preventDefault();
    isGesturing = false;
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();

    const pointer = getMousePos(canvas, e as unknown as MouseEvent);
    setLastPointer(pointer);

    const normalizedDeltaY =
      e.deltaMode === 1
        ? e.deltaY * 16
        : e.deltaMode === 2
          ? e.deltaY * window.innerHeight
          : e.deltaY;

    const viewport = getViewport();

    if (e.ctrlKey || e.metaKey) {
      if (isGesturing) return; // Safari fires both gesture and wheel events, avoid double zoom
      const worldPoint = screenToWorldPoint(pointer, viewport);
      const zoomFactor = Math.exp(-normalizedDeltaY * WHEEL_ZOOM_SENSITIVITY);
      const nextScale = clamp(viewport.scale * zoomFactor, MIN_ZOOM, MAX_ZOOM);

      setViewport({
        scale: nextScale,
        x: pointer.x - worldPoint.x * nextScale,
        y: pointer.y - worldPoint.y * nextScale,
      });

      updateCursor();
      requestRender();
      return;
    }

    setViewport({
      ...viewport,
      x: viewport.x - e.deltaX * WHEEL_PAN_SENSITIVITY,
      y: viewport.y - e.deltaY * WHEEL_PAN_SENSITIVITY,
    });

    updateCursor();
    requestRender();
  };

  window.addEventListener("mouseup", handleWindowMouseUp);
  window.addEventListener("blur", handleWindowBlur);
  window.addEventListener("keyup", handleWindowKeyUp);
  window.addEventListener("resize", handleWindowResize);

  canvas.addEventListener("wheel", handleWheel, { passive: false });
  canvas.addEventListener("gesturestart", handleGestureStart as EventListener, {
    passive: false,
  });
  canvas.addEventListener(
    "gesturechange",
    handleGestureChange as EventListener,
    { passive: false },
  );
  canvas.addEventListener("gestureend", handleGestureEnd as EventListener, {
    passive: false,
  });

  return () => {
    window.removeEventListener("mouseup", handleWindowMouseUp);
    window.removeEventListener("blur", handleWindowBlur);
    window.removeEventListener("keyup", handleWindowKeyUp);
    window.removeEventListener("resize", handleWindowResize);
    canvas.removeEventListener("wheel", handleWheel);
    canvas.removeEventListener(
      "gesturestart",
      handleGestureStart as EventListener,
    );
    canvas.removeEventListener(
      "gesturechange",
      handleGestureChange as EventListener,
    );
    canvas.removeEventListener("gestureend", handleGestureEnd as EventListener);
    if (renderRaf !== null) cancelAnimationFrame(renderRaf);
  };
}
