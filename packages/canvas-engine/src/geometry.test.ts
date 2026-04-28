import { describe, it, expect } from 'vitest';
import { convertToPoints, convertBackToShape, normalize, resizeShape } from './geometry';
import { Shape } from './types';

describe('Geometry Utils', () => {
    describe('convertToPoints', () => {
        it('should convert a rect to points', () => {
            const rect: Shape = { type: 'rect', x: 10, y: 20, width: 30, height: 40, id: '1', color: '#000' } as any;
            const points = convertToPoints(rect);
            expect(points).toEqual({ x1: 10, y1: 20, x2: 40, y2: 60 });
        });

        it('should convert a circle to points', () => {
            const circle: Shape = { type: 'circle', centerX: 50, centerY: 50, radiusX: 20, radiusY: 30, id: '1' } as any;
            const points = convertToPoints(circle);
            expect(points).toEqual({ x1: 30, y1: 20, x2: 70, y2: 80 });
        });

        it('should handle negative width/height for rect (normalize)', () => {
            const rect: Shape = { type: 'rect', x: 10, y: 10, width: -5, height: -5, id: '1' } as any;
            const points = convertToPoints(rect);
            expect(points).toEqual({ x1: 5, y1: 5, x2: 10, y2: 10 });
        });

        it('should convert a line to points', () => {
            const line: Shape = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100, id: '1' } as any;
            const points = convertToPoints(line);
            expect(points).toEqual({ x1: 0, y1: 0, x2: 100, y2: 100 });
        });

        it('should convert a rhombus to points', () => {
            const rhombus: Shape = { type: 'rhombus', x: 10, y: 10, width: 20, height: 20, id: '1' } as any;
            const points = convertToPoints(rhombus);
            expect(points).toEqual({ x1: 10, y1: 10, x2: 30, y2: 30 });
        });
    });

    describe('normalize', () => {
        it('should normalize coordinates regardless of order', () => {
            expect(normalize({ x1: 10, y1: 10, x2: 0, y2: 0 })).toEqual({ x1: 0, y1: 0, x2: 10, y2: 10 });
            expect(normalize({ x1: 0, y1: 0, x2: 10, y2: 10 })).toEqual({ x1: 0, y1: 0, x2: 10, y2: 10 });
        });
    });

    describe('convertBackToShape', () => {
        it('should convert points back to a rect', () => {
            const originalRect: Shape = { type: 'rect' } as any;
            const box = { x1: 10, y1: 20, x2: 40, y2: 60 };
            const shape = convertBackToShape(originalRect, box);
            expect(shape).toMatchObject({ x: 10, y: 20, width: 30, height: 40 });
        });

        it('should convert points back to a circle', () => {
            const originalCircle: Shape = { type: 'circle' } as any;
            const box = { x1: 30, y1: 20, x2: 70, y2: 80 };
            const shape = convertBackToShape(originalCircle, box);
            expect(shape).toMatchObject({ centerX: 50, centerY: 50, radiusX: 20, radiusY: 30 });
        });
    });

    describe('resizeShape', () => {
        it('should resize a rect from the bottom-right handle', () => {
            const rect: Shape = { type: 'rect', x: 10, y: 10, width: 50, height: 50, id: '1' } as any;
            const resized = resizeShape(rect, 'bottom-right', 100, 100);
            expect(resized).toMatchObject({ x: 10, y: 10, width: 90, height: 90 });
        });

        it('should resize a rect from the top-left handle', () => {
            const rect: Shape = { type: 'rect', x: 50, y: 50, width: 50, height: 50, id: '1' } as any;
            const resized = resizeShape(rect, 'top-left', 10, 10);
            expect(resized).toMatchObject({ x: 10, y: 10, width: 90, height: 90 });
        });

        it('should resize from center when fromCenter is true', () => {
            const rect: Shape = { type: 'rect', x: 40, y: 40, width: 20, height: 20, id: '1' } as any;
            // Original center: (50, 50). Dragging right handle to 70.
            // Left handle should move to 30. New width should be 40.
            const resized = resizeShape(rect, 'right', 70, 50, { fromCenter: true });
            expect(resized).toMatchObject({ x: 30, y: 40, width: 40, height: 20 });
        });

        it('should resize a line start handle', () => {
            const line: Shape = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100, id: '1' } as any;
            const resized = resizeShape(line, 'start' as any, 50, 50);
            expect(resized).toMatchObject({ x1: 50, y1: 50, x2: 100, y2: 100 });
        });

        it('should preserve aspect ratio when preserveAspect is true', () => {
            const rect: Shape = { type: 'rect', x: 0, y: 0, width: 50, height: 50, id: '1' } as any;
            // Dragging bottom-right to (100, 150) should result in (150, 150) to keep 1:1 aspect
            const resized = resizeShape(rect, 'bottom-right', 100, 150, { preserveAspect: true }) as any;
            expect(resized.width).toBe(resized.height);
            expect(resized.width).toBe(150);
        });
    });
});
