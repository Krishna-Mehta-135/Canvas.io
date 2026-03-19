import { Shape } from "./types";

export class CanvasState{
    private shapes: Shape[] = [];

    setShapes(shapes: Shape[]){
        this.shapes = shapes;
    }

    addShape(shape: Shape) {
        this.shapes.push(shape);
    }

    getShapes() {
        //We did this instead of normal this.shapes because we don't want to allow silent mutations like shapes.pop() or shapes.push(), so we use the spread operator to create a new array with all elements of the original array .
        //If we have silent mutations we will have state changes that are not reflected in the UI, history not updating which will lead to bugs.
        return [...this.shapes];
    }
}