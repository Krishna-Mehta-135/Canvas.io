"use client";

import { motion } from "motion/react";
import { useState, useRef, useCallback } from "react";
import { Sparkles } from "lucide-react";

interface Box {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Connection {
  from: string;
  to: string;
}

const initialBoxes: Box[] = [
  { id: "api", label: "API Gateway", x: 60, y: 150, width: 140, height: 60 },
  { id: "rate", label: "Rate Limiter", x: 260, y: 140, width: 140, height: 60 },
  { id: "cache", label: "Redis Cache", x: 460, y: 150, width: 140, height: 60 },
  { id: "backend", label: "Backend API", x: 660, y: 150, width: 140, height: 60 },
  { id: "db", label: "PostgreSQL", x: 460, y: 330, width: 140, height: 60 },
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

  const handleMouseDown = useCallback((id: string, e: React.MouseEvent) => {
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
  }, [boxes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;

    setBoxes((prev) =>
      prev.map((box) =>
        box.id === dragging
          ? { ...box, x: Math.max(0, Math.min(800 - box.width, newX)), y: Math.max(0, Math.min(600 - box.height, newY)) }
          : box
      )
    );
  }, [dragging, dragOffset]);

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
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy) {
      const midX = start.x + dx / 2;
      return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
    } else {
      const midY = start.y + dy / 2;
      return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
    }
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-[600px] bg-gray-50 dark:bg-[#0a0a0a] rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => setSelectedBox(null)}
    >
      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-30 dark:opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(100,100,100,0.2) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* SVG for connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <marker
            id="arrowhead-light"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#6366f1" />
          </marker>
          <marker
            id="arrowhead-dark"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#6366f1" />
          </marker>
        </defs>
        {connections.map((conn, i) => (
          <motion.path
            key={`${conn.from}-${conn.to}`}
            d={getConnectionPath(conn.from, conn.to)}
            stroke="#6366f1"
            strokeWidth="2"
            fill="none"
            markerEnd="url(#arrowhead-dark)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.6 }}
            transition={{ delay: 1 + i * 0.2, duration: 0.6 }}
            className="dark:opacity-60 opacity-80"
          />
        ))}
      </svg>

      {/* Draggable boxes */}
      {boxes.map((box, index) => (
        <motion.div
          key={box.id}
          className={`absolute cursor-move rounded-xl border-2 backdrop-blur-sm transition-all ${
            selectedBox === box.id
              ? "border-blue-500 bg-blue-500/10 dark:bg-blue-500/10 shadow-lg shadow-blue-500/20"
              : box.id === "rate"
              ? "border-indigo-500/50 bg-indigo-500/5 dark:bg-indigo-500/5"
              : "border-gray-300 dark:border-white/20 bg-white/80 dark:bg-white/5 hover:border-gray-400 dark:hover:border-white/40"
          }`}
          style={{
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 + index * 0.1, type: "spring" }}
          onMouseDown={(e) => handleMouseDown(box.id, e)}
          whileHover={{ scale: dragging ? 1 : 1.02 }}
        >
          <div className="w-full h-full flex items-center justify-center px-4">
            <p className="text-gray-900 dark:text-white/90 font-medium text-sm text-center select-none">
              {box.label}
            </p>
          </div>

          {/* Selection handles */}
          {selectedBox === box.id && (
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
                  className="absolute w-2 h-2 bg-blue-500 border border-white/20 rounded-sm pointer-events-none"
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
          {box.id === "rate" && (
            <motion.div
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600/90 backdrop-blur-sm rounded-md text-xs text-white/90 whitespace-nowrap shadow-lg pointer-events-none"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              AI-generated
            </motion.div>
          )}
        </motion.div>
      ))}

      {/* Floating hint */}
      <motion.div
        className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-indigo-600/90 backdrop-blur-md text-gray-900 dark:text-white px-4 py-2 rounded-lg text-sm shadow-xl border border-gray-200 dark:border-indigo-500/30"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5 }}
      >
        ✨ Try dragging the boxes around!
      </motion.div>

      {/* Animated cursors */}
      <AnimatedCursor
        name="Sarah"
        color="bg-purple-500"
        path={[
          { x: 260, y: 140 },
          { x: 300, y: 160 },
          { x: 280, y: 180 },
          { x: 260, y: 140 },
        ]}
        delay={0}
      />
      <AnimatedCursor
        name="Mike"
        color="bg-green-500"
        path={[
          { x: 460, y: 330 },
          { x: 500, y: 350 },
          { x: 480, y: 370 },
          { x: 460, y: 330 },
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
      className="absolute pointer-events-none z-50"
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
      {/* Cursor pointer */}
      <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-lg">
        <path d="M3 2L15 10L10 11L7 17L3 2Z" fill="currentColor" />
      </svg>
      {/* Cursor label */}
      <motion.div
        className={`absolute top-5 left-5 px-2 py-1 ${color} text-white text-xs rounded whitespace-nowrap shadow-lg`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.3 }}
      >
        {name}
      </motion.div>
    </motion.div>
  );
}
