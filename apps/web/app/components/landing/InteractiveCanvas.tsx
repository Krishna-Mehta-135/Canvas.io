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
    type: "server",
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

export function InteractiveCanvas() {
  const [boxes, setBoxes] = useState<Box[]>(initialBoxes);
  const [connections] = useState<Connection[]>(initialConnections);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseDown = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const box = boxes.find((b) => b.id === id);
      if (!box) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      setDragging(id);
      setSelectedBox(id);
      setDragOffset({
        x: e.clientX - rect.left - box.x,
        y: e.clientY - rect.top - box.y,
      });
    },
    [boxes],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;

      setBoxes((prev) =>
        prev.map((box) =>
          box.id === dragging
            ? {
                ...box,
                x: Math.max(0, Math.min(1000 - box.width, newX)),
                y: Math.max(0, Math.min(500 - box.height, newY)),
              }
            : box,
        ),
      );
    },
    [dragging, dragOffset],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const getBoxCenter = (box: Box) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });

  const getConnectionPath = (from: string, to: string) => {
    const fromBox = boxes.find((b) => b.id === from);
    const toBox = boxes.find((b) => b.id === to);
    if (!fromBox || !toBox) return "";

    const start = getBoxCenter(fromBox);
    const end = getBoxCenter(toBox);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const MathAbsDx = Math.abs(dx);
    const MathAbsDy = Math.abs(dy);

    if (MathAbsDx > MathAbsDy) {
      const midX = start.x + dx / 2;
      return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
    } else {
      const midY = start.y + dy / 2;
      return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
    }
  };

  if (!mounted) return null;

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full bg-transparent overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => setSelectedBox(null)}
    >
      {/* SVG for connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
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
        {connections.map((conn, i) => (
          <motion.path
            key={`${conn.from}-${conn.to}`}
            d={getConnectionPath(conn.from, conn.to)}
            stroke="#94a3b8"
            strokeWidth="2"
            fill="none"
            markerEnd="url(#arrowhead-dark)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 1 + i * 0.2, duration: 0.5, ease: "easeOut" }}
          />
        ))}
      </svg>

      {/* Draggable boxes */}
      {boxes.map((box, index) => {
        const isSelected = selectedBox === box.id;
        const isAi = box.type === "ai";

        return (
          <motion.div
            key={box.id}
            className={`absolute cursor-move rounded-xl border-2 shadow-xl transition-colors z-10 flex flex-col overflow-hidden ${
              isSelected
                ? "border-blue-400 bg-white dark:bg-[#1e293b] shadow-blue-500/20"
                : isAi
                  ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-600 shadow-indigo-500/20"
                  : "border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1e293b] hover:border-slate-300 dark:hover:border-slate-600 shadow-slate-200 dark:shadow-black/20"
            }`}
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.8 + index * 0.1,
              type: "spring",
              stiffness: 400,
              damping: 25,
            }}
            onMouseDown={(e) => handleMouseDown(box.id, e)}
            whileHover={{ scale: dragging ? 1 : 1.02 }}
          >
            {/* Top color bar */}
            <div
              className={`h-1.5 w-full ${isAi ? "bg-indigo-400" : "bg-slate-300 dark:bg-slate-600"}`}
            />

            <div className="flex-1 flex items-center justify-center px-4">
              <p
                className={`font-bold text-xs text-center select-none tracking-wide text-slate-800 dark:text-white`}
              >
                {box.label}
              </p>
            </div>

            {/* Selection handles */}
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
                ].map(([dx, dy], i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-blue-400 border border-white dark:border-[#1e293b] rounded-sm pointer-events-none"
                    style={{
                      left: `${dx}%`,
                      top: `${dy}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ))}
              </>
            )}

            {/* AI badge for rate limiter */}
            {isAi && (
              <motion.div
                className="absolute -top-3 -right-3 w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center shadow-sm"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5, type: "spring" }}
              >
                <Sparkles className="w-3 h-3 text-white" />
              </motion.div>
            )}
          </motion.div>
        );
      })}

      {/* Floating hint */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg text-xs font-bold shadow-xl border border-slate-700 dark:border-slate-200 z-50 pointer-events-none"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5 }}
      >
        Try dragging the nodes around
      </motion.div>

      {/* Animated cursors */}
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
      className="absolute pointer-events-none z-40"
      initial={{ x: path[0]!.x, y: path[0]!.y, opacity: 0 }}
      animate={{
        x: path.map((p) => p.x),
        y: path.map((p) => p.y),
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
          d="M3 2L15 10L10 11L7 17L3 2Z"
          fill="currentColor"
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      <motion.div
        className={`absolute top-4 left-4 px-2 py-0.5 ${color} text-white text-[10px] font-bold rounded shadow-sm`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.3 }}
      >
        {name}
      </motion.div>
    </motion.div>
  );
}
