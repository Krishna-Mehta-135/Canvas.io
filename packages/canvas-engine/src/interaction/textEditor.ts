type InlineTextEditorOptions = {
    canvas: HTMLCanvasElement;
    x: number;
    y: number;
    initialText?: string;
    fontSize?: number;
    onCommit: (payload: {text: string; width: number; height: number; fontSize: number}) => void;
    onCancel?: () => void;
};

/**
 * Creates a temporary inline textarea layered over the canvas.
 * Returns a cleanup function that removes editor and listeners.
 */
export function createInlineTextEditor(options: InlineTextEditorOptions) {
    const {canvas, x, y, initialText = "", fontSize = 24, onCommit, onCancel} = options;

    const parent = canvas.parentElement;
    if (!parent) {
        return () => {};
    }

    const editor = document.createElement("textarea");
    editor.value = initialText;
    editor.spellcheck = false;

    const lineHeight = Math.round(fontSize * 1.25);
    let lastMeasuredWidth = 80;
    let lastMeasuredHeight = lineHeight;

    const applySize = () => {
        editor.style.height = "0px";
        const width = Math.max(80, editor.scrollWidth + 8);
        const height = Math.max(lineHeight, editor.scrollHeight + 4);
        lastMeasuredWidth = width;
        lastMeasuredHeight = height;
        editor.style.width = `${width}px`;
        editor.style.height = `${height}px`;
    };

    editor.style.position = "absolute";
    editor.style.left = `${canvas.offsetLeft + x}px`;
    editor.style.top = `${canvas.offsetTop + y}px`;
    editor.style.padding = "0";
    editor.style.margin = "0";
    editor.style.border = "none";
    editor.style.outline = "none";
    editor.style.background = "transparent";
    editor.style.color = "white";
    editor.style.resize = "none";
    editor.style.overflow = "hidden";
    editor.style.whiteSpace = "pre-wrap";
    editor.style.font = `${fontSize}px Virgil, Caveat, ui-rounded, sans-serif`;
    editor.style.lineHeight = `${lineHeight}px`;
    editor.style.zIndex = "30";

    let closed = false;

    const cleanup = () => {
        if (closed) return;
        closed = true;

        editor.removeEventListener("input", applySize);
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
        commit();
    };

    editor.addEventListener("input", applySize);
    editor.addEventListener("keydown", onKeyDown);
    editor.addEventListener("mousedown", stopPropagation);
    editor.addEventListener("click", stopPropagation);
    editor.addEventListener("blur", onBlur);

    parent.appendChild(editor);
    applySize();
    editor.focus();
    editor.select();

    return cleanup;
}
