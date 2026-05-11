"use client";

import { motion } from "motion/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { getConnectorRoutePoints } from "@repo/canvas-engine";

interface Box {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type?: "db" | "server" | "ai";
}

interface Connection {
  from: string;
  to: string;
}

type LayoutConfig = {
  width: number;
  height: number;
  boxes: Box[];
  cursors: Array<{
    name: string;
    color: string;
    delay: number;
  }>;
};

const initialConnections: Connection[] = [
  { from: "api", to: "rate" },
  { from: "rate", to: "cache" },
  { from: "cache", to: "backend" },
  { from: "cache", to: "db" },
];

const desktopLayout: LayoutConfig = {
  width: 1000,
  height: 500,
  boxes: [
    {
      id: "api",
      label: "API Gateway",
      x: 60,
      y: 170,
      width: 160,
      height: 60,
      type: "server",
    },
    {
      id: "rate",
      label: "Rate Limiter",
      x: 300,
      y: 160,
      width: 170,
      height: 70,
      type: "ai",
    },
    {
      id: "cache",
      label: "Redis Cache",
      x: 550,
      y: 170,
      width: 160,
      height: 60,
      type: "db",
    },
    {
      id: "backend",
      label: "Backend API",
      x: 790,
      y: 170,
      width: 170,
      height: 60,
      type: "server",
    },
    {
      id: "db",
      label: "PostgreSQL",
      x: 550,
      y: 330,
      width: 160,
      height: 60,
      type: "db",
    },
  ],
  cursors: [
    {
      name: "Sarah C.",
      color: "bg-indigo-500",
      delay: 0,
    },
    {
      name: "Mike T.",
      color: "bg-emerald-500",
      delay: 3,
    },
  ],
};

const mobileLayout: LayoutConfig = {
  width: 420,
  height: 620,
  boxes: [
    {
      id: "rate",
      label: "Rate Limiter",
      x: 140,
      y: 46,
      width: 120,
      height: 70,
      type: "ai",
    },
    {
      id: "api",
      label: "API Gateway",
      x: 28,
      y: 190,
      width: 108,
      height: 70,
      type: "server",
    },
    {
      id: "cache",
      label: "Redis Cache",
      x: 272,
      y: 170,
      width: 118,
      height: 70,
      type: "db",
    },
    {
      id: "backend",
      label: "Backend API",
      x: 282,
      y: 355,
      width: 118,
      height: 74,
      type: "server",
    },
    {
      id: "db",
      label: "PostgreSQL",
      x: 158,
      y: 480,
      width: 118,
      height: 70,
      type: "db",
    },
  ],
  cursors: [],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toPercent(value: number, max: number) {
  return `${(value / max) * 100}%`;
}

function getAnchorPoints(fromBox: Box, toBox: Box) {
  const fromCenter = {
    x: fromBox.x + fromBox.width / 2,
    y: fromBox.y + fromBox.height / 2,
  };
  const toCenter = {
    x: toBox.x + toBox.width / 2,
    y: toBox.y + toBox.height / 2,
  };

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  // Prefer horizontal connections for things that are mostly horizontally aligned
  const horizontalBias = 1.25;

  if (Math.abs(dx) * horizontalBias >= Math.abs(dy)) {
    return {
      start: {
        x: dx >= 0 ? fromBox.x + fromBox.width : fromBox.x,
        y: fromCenter.y,
      },
      end: {
        x: dx >= 0 ? toBox.x : toBox.x + toBox.width,
        y: toCenter.y,
      },
    };
  }

  return {
    start: {
      x: fromCenter.x,
      y: dy >= 0 ? fromBox.y + fromBox.height : fromBox.y,
    },
    end: {
      x: toCenter.x,
      y: dy >= 0 ? toBox.y : toBox.y + toBox.height,
    },
  };
}

export function InteractiveCanvas() {
  const [isCompact, setIsCompact] = useState(false);
  const layout = isCompact ? mobileLayout : desktopLayout;
  const [boxes, setBoxes] = useState<Box[]>(layout.boxes);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const sync = () => {
      setIsCompact(mediaQuery.matches);
    };

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setBoxes(layout.boxes);
    setSelectedBox(null);
    setDragging(null);
    pointerIdRef.current = null;
  }, [layout]);

  const updateDraggedBox = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragging || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = layout.width / rect.width;
      const scaleY = layout.height / rect.height;
      const newX = (clientX - rect.left) * scaleX - dragOffset.x;
      const newY = (clientY - rect.top) * scaleY - dragOffset.y;

      setBoxes((prev) =>
        prev.map((box) =>
          box.id === dragging
            ? {
                ...box,
                x: clamp(newX, 0, layout.width - box.width),
                y: clamp(newY, 0, layout.height - box.height),
              }
            : box,
        ),
      );
    },
    [dragging, dragOffset, layout.height, layout.width],
  );

  const stopDragging = useCallback(() => {
    setDragging(null);
    pointerIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (
        pointerIdRef.current !== null &&
        event.pointerId !== pointerIdRef.current
      ) {
        return;
      }

      updateDraggedBox(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (
        pointerIdRef.current !== null &&
        event.pointerId !== pointerIdRef.current
      ) {
        return;
      }

      stopDragging();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragging, stopDragging, updateDraggedBox]);

  const handlePointerDown = useCallback(
    (id: string, event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();

      const box = boxes.find((candidate) => candidate.id === id);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!box || !rect) return;

      pointerIdRef.current = event.pointerId;
      setDragging(id);
      setSelectedBox(id);
      setDragOffset({
        x: (event.clientX - rect.left) * (layout.width / rect.width) - box.x,
        y: (event.clientY - rect.top) * (layout.height / rect.height) - box.y,
      });

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [boxes, layout.height, layout.width],
  );

  const getConnectionPath = (from: string, to: string) => {
    const fromBox = boxes.find((box) => box.id === from);
    const toBox = boxes.find((box) => box.id === to);
    if (!fromBox || !toBox) return "";

    const anchors = getAnchorPoints(fromBox, toBox);
    const routePoints = getConnectorRoutePoints({
      x1: anchors.start.x,
      y1: anchors.start.y,
      x2: anchors.end.x,
      y2: anchors.end.y,
    });

    return routePoints
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
      )
      .join(" ");
  };

  if (!mounted) return null;

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full touch-none overflow-hidden rounded-2xl bg-transparent"
      onClick={() => setSelectedBox(null)}
    >
      <svg
        className="absolute inset-0 z-0 h-full w-full pointer-events-none"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id="arrowhead-dark"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
          >
            <polygon points="0 0, 10 5, 0 10" fill="#94a3b8" />
          </marker>
        </defs>
        {initialConnections.map((connection, index) => (
          <motion.path
            key={`${connection.from}-${connection.to}`}
            d={getConnectionPath(connection.from, connection.to)}
            stroke="#aab4c8"
            strokeWidth={isCompact ? 2.2 : 2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd="url(#arrowhead-dark)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              delay: 0.9 + index * 0.18,
              duration: 0.45,
              ease: "easeOut",
            }}
          />
        ))}
      </svg>

      {boxes.map((box, index) => {
        const isSelected = selectedBox === box.id;
        const isAi = box.type === "ai";

        return (
          <motion.div
            key={box.id}
            className={`absolute z-10 flex cursor-grab touch-none flex-col overflow-hidden rounded-lg border shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-colors active:cursor-grabbing ${
              isSelected
                ? "border-blue-400 bg-[#172036] shadow-blue-500/20"
                : isAi
                  ? "border-indigo-400 bg-[linear-gradient(180deg,#5b4dff_0%,#4a37e6_100%)] shadow-indigo-500/30"
                  : "border-slate-700/70 bg-[#1f2937]/92"
            }`}
            style={{
              left: toPercent(box.x, layout.width),
              top: toPercent(box.y, layout.height),
              width: toPercent(box.width, layout.width),
              height: toPercent(box.height, layout.height),
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.55 + index * 0.08,
              type: "spring",
              stiffness: 360,
              damping: 28,
            }}
            onPointerDown={(event) => handlePointerDown(box.id, event)}
            whileHover={{ scale: dragging ? 1 : 1.015 }}
          >
            <div
              className={`h-1.5 w-full ${isAi ? "bg-white/40" : "bg-slate-500/55"}`}
            />

            <div className="flex flex-1 items-center justify-center px-3">
              <p className="select-none text-center text-sm font-bold tracking-tight text-white sm:text-base">
                {box.label}
              </p>
            </div>

            {isSelected && (
              <>
                {[
                  [0, 0],
                  [100, 0],
                  [0, 100],
                  [100, 100],
                  [50, 0],
                  [50, 100],
                  [0, 50],
                  [100, 50],
                ].map(([dx, dy], handleIndex) => (
                  <div
                    key={handleIndex}
                    className="pointer-events-none absolute h-2.5 w-2.5 rounded-sm border border-[#172036] bg-blue-400"
                    style={{
                      left: `${dx}%`,
                      top: `${dy}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ))}
              </>
            )}

            {isAi && (
              <motion.div
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-md bg-white text-indigo-600 shadow-sm"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.15, type: "spring" }}
              >
                <Sparkles className="h-3 w-3" />
              </motion.div>
            )}
          </motion.div>
        );
      })}

      <motion.div
        className="pointer-events-none absolute bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/96 px-4 py-3 text-center text-[11px] font-bold text-slate-800 shadow-xl sm:bottom-5 sm:px-5 sm:text-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2 }}
      >
        Drag nodes around to reroute the system flow
      </motion.div>

      {layout.cursors.map((cursor) => (
        <AnimatedCursor
          key={cursor.name}
          layout={layout}
          name={cursor.name}
          color={cursor.color}
          delay={cursor.delay}
        />
      ))}
    </div>
  );
}

function AnimatedCursor({
  layout,
  name,
  color,
  delay,
}: {
  layout: LayoutConfig;
  name: string;
  color: string;
  delay: number;
}) {
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Initial random position
    setTarget({
      x: Math.random() * layout.width,
      y: Math.random() * layout.height,
    });

    const interval = setInterval(() => {
      // 1. Fade out
      setOpacity(0);

      setTimeout(() => {
        // 2. Teleport to new random location
        setTarget({
          x: Math.random() * layout.width,
          y: Math.random() * layout.height,
        });

        // 3. Fade in and start moving
        setOpacity(1);
      }, 800);
    }, 4500 + Math.random() * 3000);

    // Initial fade in
    const initialTimeout = setTimeout(() => setOpacity(1), (delay + 1) * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [layout.height, layout.width, delay]);

  return (
    <motion.div
      className="pointer-events-none absolute z-40 hidden sm:block"
      initial={{ opacity: 0 }}
      animate={{
        left: `${(target.x / layout.width) * 100}%`,
        top: `${(target.y / layout.height) * 100}%`,
        opacity: opacity,
      }}
      transition={{
        left: { duration: 2.8, ease: "easeInOut" },
        top: { duration: 2.8, ease: "easeInOut" },
        opacity: { duration: 0.6 },
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        className="drop-shadow-md text-slate-900 dark:text-white"
        style={{ transform: "rotate(-15deg)" }}
      >
        <path
          d="M3 2L15 10L9.5 11.5L11.5 17L9.5 17.8L7.5 12.3L3 15V2Z"
          fill="currentColor"
        />
      </svg>
      <div className="mt-1 flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <div className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-md dark:bg-slate-900/90 dark:text-white/80">
          {name}
        </div>
      </div>
    </motion.div>
  );
}
