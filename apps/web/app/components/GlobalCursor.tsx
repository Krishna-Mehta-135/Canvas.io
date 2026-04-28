"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeToggle";

const CURSOR_TRAIL_COUNT = 6;

export function GlobalCursor() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const lineTrailRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [isCursorVisible, setIsCursorVisible] = useState(false);

  useEffect(() => {
    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!supportsFinePointer) {
      return;
    }

    const trailNodes = lineTrailRefs.current
      .slice(0, CURSOR_TRAIL_COUNT)
      .filter((node): node is HTMLSpanElement => node !== null);
    if (trailNodes.length !== CURSOR_TRAIL_COUNT) {
      return;
    }

    let animationFrameId = 0;

    const target = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    const head = {
      x: target.x,
      y: target.y,
    };
    const trailPoints = Array.from({ length: CURSOR_TRAIL_COUNT + 1 }, () => ({
      x: target.x,
      y: target.y,
    }));

    const updateVisibility = (nextVisible: boolean) => {
      setIsCursorVisible(nextVisible);
    };

    const onPointerEnter = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      updateVisibility(true);
    };

    const onPointerMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      updateVisibility(true);
    };

    const onPointerLeave = () => {
      updateVisibility(false);
    };

    const animate = () => {
      const headTrailPoint = trailPoints[0];
      if (!headTrailPoint) {
        animationFrameId = window.requestAnimationFrame(animate);
        return;
      }

      head.x += (target.x - head.x) * 0.28;
      head.y += (target.y - head.y) * 0.28;

      headTrailPoint.x += (head.x - headTrailPoint.x) * 0.44;
      headTrailPoint.y += (head.y - headTrailPoint.y) * 0.44;

      for (let i = 1; i < trailPoints.length; i += 1) {
        const prevPoint = trailPoints[i - 1];
        const currentPoint = trailPoints[i];
        if (!prevPoint || !currentPoint) {
          continue;
        }

        currentPoint.x += (prevPoint.x - currentPoint.x) * 0.42;
        currentPoint.y += (prevPoint.y - currentPoint.y) * 0.42;
      }

      for (let i = 0; i < trailNodes.length; i += 1) {
        const node = trailNodes[i];
        const start = trailPoints[i];
        const end = trailPoints[i + 1];
        if (!node || !start || !end) {
          continue;
        }

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        const segmentLength = Math.hypot(dx, dy);
        const baseLength = 20 - i * 2.4;
        const width = Math.max(
          6,
          Math.min(34, baseLength + segmentLength * 0.85),
        );
        const opacity = Math.max(0.12, 0.62 - i * 0.1);

        node.style.width = `${width}px`;
        node.style.opacity = `${opacity}`;
        node.style.transform = `translate3d(${start.x}px, ${start.y}px, 0) rotate(${angle}rad)`;
      }

      animationFrameId = window.requestAnimationFrame(animate);
    };

    window.addEventListener("pointerenter", onPointerEnter);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);

    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointerenter", onPointerEnter);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
    };
  }, []);

  return (
    <div className="canvas-cursor-layer" aria-hidden="true">
      {Array.from({ length: CURSOR_TRAIL_COUNT }, (_, index) => (
        <span
          key={`cursor-trail-${index}`}
          ref={(node) => {
            lineTrailRefs.current[index] = node;
          }}
          className={`canvas-cursor-line ${isDark ? "canvas-cursor-line-dark" : "canvas-cursor-line-light"} ${isCursorVisible ? "opacity-100" : "opacity-0"}`}
        />
      ))}
    </div>
  );
}
