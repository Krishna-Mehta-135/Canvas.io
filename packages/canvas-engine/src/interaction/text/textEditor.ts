type InlineTextEditorOptions = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    screenX: number;
    screenY: number;
    initialText?: string;
    fontSize?: number;
    onInput?: (text: string) => void;
    onCommit: (payload: {text: string; width: number; height: number; fontSize: number}) => void;
    onCancel?: () => void;
};

/**
 * Creates a temporary inline textarea layered over the canvas with live preview.
 * Text is rendered on canvas as user types via onInput callback.
 * Returns a cleanup function that removes editor and listeners.
 */
export function createInlineTextEditor(options: InlineTextEditorOptions) {
    const {canvas, screenX, screenY, initialText = "", fontSize = 24, onInput, onCommit, onCancel} = options;



    const editor = document.createElement("textarea");
    editor.value = initialText;
    editor.spellcheck = false;

    const lineHeight = Math.round(fontSize * 1.25);
    let lastMeasuredWidth = 80;
    let lastMeasuredHeight = lineHeight;

    const applySize = () => {
        // Use textarea's own layout metrics to keep caret and glyph flow in sync.
        editor.style.width = "0px";
        editor.style.height = "0px";

        const width = Math.max(16, editor.scrollWidth + 2);
        const height = Math.max(lineHeight, editor.scrollHeight + 2);

        lastMeasuredWidth = width;
        lastMeasuredHeight = height;
        editor.style.width = `${width}px`;
        editor.style.height = `${height}px`;
    };

    const rect = canvas.getBoundingClientRect();



    editor.style.position = "fixed";
    editor.style.left = `${rect.left + screenX}px`;
    editor.style.top = `${rect.top + screenY}px`;
    editor.style.padding = "0";
    editor.style.margin = "0";
    editor.style.border = "none";
    editor.style.outline = "none";
    editor.style.background = "transparent";
    editor.style.color = "transparent"; // Hide the text inside textarea
    editor.style.caretColor = "white"; // Keep cursor visible
    editor.style.resize = "none";
    editor.style.overflow = "hidden";
    editor.style.whiteSpace = "pre";
    editor.style.overflowWrap = "normal";
    editor.style.wordBreak = "normal";
    editor.style.font = `${fontSize}px Virgil, Caveat, ui-rounded, sans-serif`;
    editor.style.lineHeight = `${lineHeight}px`;
    editor.style.zIndex = "10000";
    editor.rows = 1;
    editor.cols = 1;
    editor.wrap = "off";

    let closed = false;

    const cleanup = () => {
        if (closed) return;
        closed = true;

        editor.removeEventListener("input", onInputHandler);
        editor.removeEventListener("keydown", onKeyDown);
        editor.removeEventListener("mousedown", stopPropagation);
        editor.removeEventListener("click", stopPropagation);
        editor.removeEventListener("blur", onBlur);

        if (editor.parentElement) {
            editor.parentElement.removeChild(editor);
        }
    };

    const commit = () => {
        if (closed) return;

        const text = editor.value;
        const width = Math.max(8, lastMeasuredWidth);
        const height = Math.max(lineHeight, lastMeasuredHeight);

        cleanup();
        onCommit({text, width, height, fontSize});
    };

    const cancel = () => {
        if (closed) return;
        cleanup();
        onCancel?.();
    };

    const stopPropagation = (event: Event) => {
        event.stopPropagation();
    };

    const onInputHandler = () => {
        applySize();
        // Call live preview callback
        if (onInput) {
            onInput(editor.value);
        }
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            cancel();
        }
    };

    const onBlur = () => {
        // Only commit on blur if there's actual content
        // If empty, cancel instead (user probably clicked away by accident)
        if (editor.value.trim()) {
            commit();
        } else {
            cancel();
        }
    };

    editor.addEventListener("input", onInputHandler);
    editor.addEventListener("keydown", onKeyDown);
    editor.addEventListener("mousedown", stopPropagation);
    editor.addEventListener("click", stopPropagation);
    editor.addEventListener("blur", onBlur);

    document.body.appendChild(editor);
    applySize();
    editor.focus();
    editor.select();

    return cleanup;
}
