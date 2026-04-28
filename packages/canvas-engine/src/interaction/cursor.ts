import { Handle } from "../types";

/**
 * Maps a resize handle to the corresponding CSS cursor.
 */
export function getCursorForHandle(handle: Handle) {
  switch (handle) {
    case "top-left":
    case "bottom-right":
      return "nwse-resize";
    case "top-right":
    case "bottom-left":
      return "nesw-resize";
    case "left":
    case "right":
      return "ew-resize";
    case "top":
    case "bottom":
      return "ns-resize";
    case "start":
    case "end":
      return "pointer";
  }
}
