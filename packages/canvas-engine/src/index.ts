/**
 * Public canvas-engine API surface consumed by apps.
 */
export { attachEvents } from "./events";
export { CanvasState } from "./state";
export { convertToPoints } from "./geometry";
export { dispatch } from "./store";
export type { Shape } from "./types";
export type { Tool } from "./interaction/tools";
export type { AttachEventsController } from "./interaction/tools";
