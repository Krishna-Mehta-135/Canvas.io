"use client";

import { motion } from "motion/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles } from "lucide-react";

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

const VIRTUAL_WIDTH = 1000;
const VIRTUAL_HEIGHT = 500;

const initialBoxes: Box[] = [
  {
    id: "api",
    label: "API Gateway",
    x: 60,
    y: 150,
    width: 140,
    height: 50,
    type: "server",
  },
  {
    id: "rate",
    label: "Rate Limiter",
    x: 280,
    y: 140,
    width: 140,
    height: 50,
    type: "ai",
  },
  {
    id: "cache",
    label: "Redis Cache",
    x: 500,
    y: 150,
    width: 140,
    height: 50,
    type: "db",
  },
  {
    id: "backend",
    label: "Backend API",
    x: 720,
    y: 150,
    width: 140,
    height: 50,
    type: "server",
  },
  {
    id: "db",
    label: "PostgreSQL",
    x: 500,
    y: 300,
    width: 140,
    height: 50,
    type: "db",
  },
];

const initialConnections: Connection[] = [
  { from: "api", to: "rate" },
  { from: "rate", to: "cache" },
  { from: "cache", to: "backend" },
  { from: "cache", to: "db" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toPercent(value: number, max: number) {
  return `${(value / max) * 100}%`;
}

export function InteractiveCanvas() {
  const [boxes, setBoxes] = useState<Box[]>(initialBoxes);
  const [connections] = useState<Connection[]>(initialConnections);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateDraggedBox = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragging || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = VIRTUAL_WIDTH / rect.width;
      const scaleY = VIRTUAL_HEIGHT / rect.height;
      const newX = (clientX - rect.left) * scaleX - dragOffset.x;
      const newY = (clientY - rect.top) * scaleY - dragOffset.y;

      setBoxes((prev) =>
        prev.map((box) =>
          box.id === dragging
            ? {
                ...box,
                x: clamp(newX, 0, VIRTUAL_WIDTH - box.width),
                y: clamp(newY, 0, VIRTUAL_HEIGHT - box.height),
              }
            : box,
        ),
      );
    },
    [dragging, dragOffset],
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
        x: (event.clientX - rect.left) * (VIRTUAL_WIDTH / rect.width) - box.x,
        y: (event.clientY - rect.top) * (VIRTUAL_HEIGHT / rect.height) - box.y,
      });

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [boxes],
  );

  const getBoxCenter = (box: Box) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });

  const getConnectionPath = (from: string, to: string) => {
    const fromBox = boxes.find((box) => box.id === from);
    const toBox = boxes.find((box) => box.id === to);
    if (!fromBox || !toBox) return "";

    const start = getBoxCenter(fromBox);
    const end = getBoxCenter(toBox);

    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  };

  if (!mounted) return null;

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full touch-none overflow-hidden bg-transparent"
      onClick={() => setSelectedBox(null)}
    >
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none z-0"
        viewBox={`0 0 ${VIRTUAL_WIDTH} ${VIRTUAL_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
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
        {connections.map((connection, index) => (
          <motion.path
            key={`${connection.from}-${connection.to}`}
            d={getConnectionPath(connection.from, connection.to)}
            stroke="#94a3b8"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            markerEnd="url(#arrowhead-dark)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              delay: 1 + index * 0.2,
              duration: 0.5,
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
            className={`absolute z-10 flex cursor-grab touch-none flex-col overflow-hidden rounded-xl border-2 shadow-xl transition-colors active:cursor-grabbing ${
              isSelected
                ? "border-blue-400 bg-white shadow-blue-500/20 dark:bg-[#1e293b]"
                : isAi
                  ? "border-indigo-400 bg-indigo-50 shadow-indigo-500/20 dark:bg-indigo-600"
                  : "border-slate-200 bg-white shadow-slate-200 dark:border-slate-700/50 dark:bg-[#1e293b] dark:shadow-black/20"
            }`}
            style={{
              left: toPercent(box.x, VIRTUAL_WIDTH),
              top: toPercent(box.y, VIRTUAL_HEIGHT),
              width: toPercent(box.width, VIRTUAL_WIDTH),
              height: toPercent(box.height, VIRTUAL_HEIGHT),
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.8 + index * 0.1,
              type: "spring",
              stiffness: 400,
              damping: 25,
            }}
            onPointerDown={(event) => handlePointerDown(box.id, event)}
            whileHover={{ scale: dragging ? 1 : 1.02 }}
          >
            <div
              className={`h-1.5 w-full ${isAi ? "bg-indigo-400" : "bg-slate-300 dark:bg-slate-600"}`}
            />

            <div className="flex flex-1 items-center justify-center px-3 sm:px-4">
              <p className="select-none text-center text-[10px] font-bold tracking-wide text-slate-800 dark:text-white sm:text-xs">
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
                    className="absolute h-2 w-2 rounded-sm border border-white bg-blue-400 pointer-events-none dark:border-[#1e293b]"
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
                className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500 shadow-sm"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5, type: "spring" }}
              >
                <Sparkles className="h-3 w-3 text-white" />
              </motion.div>
            )}
          </motion.div>
        );
      })}

      <motion.div
        className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-bold text-white shadow-xl dark:border-slate-200 dark:bg-white dark:text-slate-900 sm:bottom-6 sm:px-4 sm:text-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5 }}
      >
        Drag nodes around on desktop or touch
      </motion.div>

      <AnimatedCursor
        name="Sarah C."
        color="bg-indigo-500"
        path={[
          { x: 280, y: 140 },
          { x: 320, y: 160 },
          { x: 300, y: 180 },
          { x: 280, y: 140 },
        ]}
        delay={0}
      />
      <AnimatedCursor
        name="Mike T."
        color="bg-emerald-500"
        path={[
          { x: 500, y: 300 },
          { x: 540, y: 320 },
          { x: 520, y: 340 },
          { x: 500, y: 300 },
        ]}
        delay={3}
      />
    </div>
  );
}

function AnimatedCursor({
  name,
  color,
  path,
  delay,
}: {
  name: string;
  color: string;
  path: { x: number; y: number }[];
  delay: number;
}) {
  return (
    <motion.div
      className="absolute z-40 hidden pointer-events-none sm:block"
      initial={{ x: `${(path[0]!.x / VIRTUAL_WIDTH) * 100}%`, y: `${(path[0]!.y / VIRTUAL_HEIGHT) * 100}%`, opacity: 0 }}
      animate={{
        x: path.map((point) => `${(point.x / VIRTUAL_WIDTH) * 100}%`),
        y: path.map((point) => `${(point.y / VIRTUAL_HEIGHT) * 100}%`),
        opacity: [0, 1, 1, 1, 0],
      }}
      transition={{
        duration: 8,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
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
