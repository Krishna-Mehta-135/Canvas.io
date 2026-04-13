import {Viewport, clamp, getMousePos, screenToWorldPoint} from "../../utils";
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
    setLastPointer: (point: {x: number; y: number}) => void;
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

    window.addEventListener("mouseup", () => {
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
    });

    window.addEventListener("blur", () => {
        if (!isInteractionActive()) {
            return;
        }

        resetInteractions();
        resetToSelectTool();
        updateCursor();
        renderScene();
    });

    window.addEventListener("keyup", (e) => {
        if (e.code === "Space") {
            releaseSpacePan();
            updateCursor();
        }
    });

    window.addEventListener("resize", () => {
        const previousWidth = canvas.width;
        const previousHeight = canvas.height;
        const {width, height, pixelRatio} = resizeCanvasForViewport(canvas);

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

        renderScene();
    });

    canvas.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();

            const pointer = getMousePos(canvas, e as unknown as MouseEvent);
            setLastPointer(pointer);

            const normalizedDeltaY =
                e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;

            const viewport = getViewport();

            if (e.ctrlKey || e.metaKey) {
                const worldPoint = screenToWorldPoint(pointer, viewport);
                const zoomFactor = Math.exp(-normalizedDeltaY * WHEEL_ZOOM_SENSITIVITY);
                const nextScale = clamp(viewport.scale * zoomFactor, MIN_ZOOM, MAX_ZOOM);

                setViewport({
                    scale: nextScale,
                    x: pointer.x - worldPoint.x * nextScale,
                    y: pointer.y - worldPoint.y * nextScale,
                });

                updateCursor();
                renderScene();
                return;
            }

            setViewport({
                ...viewport,
                x: viewport.x - e.deltaX * WHEEL_PAN_SENSITIVITY,
                y: viewport.y - e.deltaY * WHEEL_PAN_SENSITIVITY,
            });

            updateCursor();
            renderScene();
        },
        {passive: false}
    );
}
