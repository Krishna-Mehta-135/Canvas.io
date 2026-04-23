"use client";

import { motion, useInView, AnimatePresence } from "motion/react";
import { useRef, useState, useEffect, useCallback } from "react";
import {
  MousePointer2,
  Square,
  Circle,
  Diamond,
  Minus,
  MoveRight,
  Type,
  Spline,
  Eraser,
  Trash2,
  Pencil,
} from "lucide-react";

const tools = [
  { icon: MousePointer2, label: "Select",    shortcut: "0", description: "Select and move elements" },
  { icon: Square,        label: "Rectangle", shortcut: "1", description: "Draw rectangles and squares" },
  { icon: Circle,        label: "Ellipse",   shortcut: "2", description: "Draw circles and ellipses" },
  { icon: Diamond,       label: "Diamond",   shortcut: "3", description: "Draw diamond shapes" },
  { icon: Minus,         label: "Line",      shortcut: "4", description: "Draw straight lines" },
  { icon: MoveRight,     label: "Arrow",     shortcut: "5", description: "Draw arrows with direction" },
  { icon: Type,          label: "Text",      shortcut: "6", description: "Add text to the canvas" },
  { icon: Spline,        label: "Freehand",  shortcut: "7", description: "Draw freehand paths" },
  { icon: Eraser,        label: "Eraser",    shortcut: "8", description: "Erase elements" },
];

export function ToolbarShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });
  const [activeTool, setActiveTool] = useState(0);
  const [lastKeyPressed, setLastKeyPressed] = useState<string | null>(null);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key;
    if (key >= "0" && key <= "8") {
      const idx = parseInt(key, 10);
      setActiveTool(idx);
      setLastKeyPressed(key);
      setTimeout(() => setLastKeyPressed(null), 1000);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const activeMeta = tools[activeTool]!;

  return (
    <section ref={ref} className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* ── Left: Text Content ── */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 dark:border-indigo-500/30 mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
            >
              <Pencil className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Powerful Tools</span>
            </motion.div>

            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60 bg-clip-text text-transparent">
              Everything you need
              <br />
              <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                at your fingertips
              </span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-white/60 mb-8 leading-relaxed">
              Intuitive tools designed for speed. Press{" "}
              <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-white/10 border border-gray-300 dark:border-white/10 rounded text-sm font-mono">0</kbd>
              –
              <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-white/10 border border-gray-300 dark:border-white/10 rounded text-sm font-mono">8</kbd>
              {" "}to switch instantly.
            </p>

            {/* Active tool info card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTool}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                  <activeMeta.icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{activeMeta.label}</p>
                  <p className="text-xs text-gray-500 dark:text-white/50 truncate">{activeMeta.description}</p>
                </div>
                <kbd className="ml-auto flex-shrink-0 px-3 py-1.5 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 rounded-lg text-sm font-mono text-gray-700 dark:text-white/70 font-bold shadow-sm">
                  {activeMeta.shortcut}
                </kbd>
              </motion.div>
            </AnimatePresence>

            <div className="space-y-3 mt-6">
              {[
                "Press 0–8 to switch tools instantly",
                "Click any tool to select it",
                "Smart snap and alignment guides",
              ].map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-white/70 text-sm">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── Right: Vertical Toolbar ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative flex justify-center"
          >
            {/* Outer card */}
            <div className="relative bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-xl flex items-start gap-6">

              {/* Vertical toolbar */}
              <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl px-2 py-3 flex flex-col gap-1 shadow-lg relative">
                {tools.map((tool, index) => (
                  <ToolButton
                    key={tool.label}
                    tool={tool}
                    index={index}
                    isInView={isInView}
                    active={activeTool === index}
                    highlighted={lastKeyPressed === tool.shortcut}
                    onClick={() => setActiveTool(index)}
                  />
                ))}

                {/* Divider */}
                <div className="h-px w-full bg-gray-200 dark:bg-white/10 my-1" />

                {/* Delete */}
                <motion.button
                  className="flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-gray-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                  whileHover={{ scale: 1.08, x: 3 }}
                  whileTap={{ scale: 0.93 }}
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.5 + tools.length * 0.05 }}
                  title="Delete selected (Del)"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="text-[10px] font-mono">Del</span>
                </motion.button>

                {/* Floating key hint — points right, follows active tool */}
                <AnimatePresence>
                  {isInView && (
                    <motion.div
                      key={activeTool}
                      className="absolute left-full ml-4 bg-indigo-500 dark:bg-indigo-600 text-white px-3.5 py-2 rounded-xl text-sm font-medium shadow-xl whitespace-nowrap pointer-events-none z-20"
                      style={{
                        // Position vertically centered on the active button
                        // Each button is ~44px tall, plus 12px padding top, plus 4px per gap
                        top: `${12 + activeTool * 48 + 12}px`,
                      }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    >
                      Press{" "}
                      <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-xs font-mono font-bold mx-0.5">
                        {activeMeta.shortcut}
                      </kbd>{" "}
                      to select
                      {/* Arrow pointing left toward the toolbar */}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-r-[8px] border-r-indigo-500 dark:border-r-indigo-600" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mini canvas preview area */}
              <div className="flex flex-col gap-3 pt-1">
                <p className="text-xs text-gray-400 dark:text-white/30 font-medium uppercase tracking-widest">
                  Canvas
                </p>
                <div className="w-48 h-64 bg-gray-50 dark:bg-[#0a0a0a] rounded-xl border border-gray-200 dark:border-white/10 relative overflow-hidden">
                  {/* Dot grid */}
                  <div
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: "radial-gradient(circle, rgba(150,150,150,0.3) 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />
                  {/* Example shapes on canvas */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTool}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.25 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <ToolPreview tool={activeMeta} />
                    </motion.div>
                  </AnimatePresence>

                  {/* Cursor indicator */}
                  <motion.div
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 dark:bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 border border-gray-200 dark:border-white/10"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <activeMeta.icon className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                    <span className="text-[10px] text-gray-600 dark:text-white/60 font-medium">{activeMeta.label}</span>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Decorative glow */}
            <motion.div
              className="absolute -inset-4 bg-gradient-to-r from-indigo-500/15 to-purple-500/15 rounded-3xl blur-2xl -z-10"
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.04, 1] }}
              transition={{ duration: 3.5, repeat: Infinity }}
            />
          </motion.div>

        </div>
      </div>
    </section>
  );
}

/* ── Individual tool button ── */
function ToolButton({
  tool, index, isInView, active, highlighted, onClick,
}: {
  tool: typeof tools[0];
  index: number;
  isInView: boolean;
  active: boolean;
  highlighted: boolean;
  onClick: () => void;
}) {
  const Icon = tool.icon;
  return (
    <motion.button
      onClick={onClick}
      title={`${tool.label} (${tool.shortcut})`}
      className={`relative flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-xl transition-all ${
        active
          ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
          : "text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white"
      }`}
      initial={{ opacity: 0, x: -15 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ delay: 0.4 + index * 0.045 }}
      whileHover={{ scale: 1.1, x: 3 }}
      whileTap={{ scale: 0.92 }}
    >
      <Icon className="w-5 h-5" />
      <span className={`text-[10px] font-mono leading-none ${active ? "text-indigo-500 dark:text-indigo-400" : "text-gray-400 dark:text-white/30"}`}>
        {tool.shortcut}
      </span>

      {/* Animated selection ring */}
      {active && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-indigo-400 dark:border-indigo-500"
          layoutId="activeToolRing"
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        />
      )}

      {/* Key-press flash */}
      <AnimatePresence>
        {highlighted && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-indigo-400/30"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ── Mini preview of what each tool draws ── */
function ToolPreview({ tool }: { tool: typeof tools[0] }) {
  const Icon = tool.icon;

  // For Select: show a dashed selection box around a shape
  if (tool.shortcut === "0") return (
    <div className="relative">
      <div className="w-20 h-16 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 border-2 border-indigo-400 dark:border-indigo-500" />
      <div className="absolute -inset-2 border-2 border-dashed border-indigo-400/60 dark:border-indigo-400/40 rounded-xl" />
      {[[-2,-2],[18,-2],[-2,18],[18,18]].map(([x,y],i) => (
        <div key={i} className="absolute w-2 h-2 bg-indigo-500 rounded-sm" style={{ left: x, top: y }} />
      ))}
    </div>
  );

  // For Rectangle
  if (tool.shortcut === "1") return (
    <motion.div
      className="w-28 h-20 rounded-lg border-2 border-indigo-500 dark:border-indigo-400 bg-indigo-500/10"
      initial={{ width: 0, height: 0 }}
      animate={{ width: 112, height: 80 }}
      transition={{ duration: 0.4 }}
    />
  );

  // For Ellipse
  if (tool.shortcut === "2") return (
    <motion.div
      className="w-28 h-20 rounded-full border-2 border-purple-500 dark:border-purple-400 bg-purple-500/10"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200 }}
    />
  );

  // For Diamond
  if (tool.shortcut === "3") return (
    <motion.div
      className="w-16 h-16 border-2 border-pink-500 dark:border-pink-400 bg-pink-500/10"
      style={{ transform: "rotate(45deg)" }}
      initial={{ scale: 0, rotate: 0 }}
      animate={{ scale: 1, rotate: 45 }}
      transition={{ duration: 0.4 }}
    />
  );

  // For Line
  if (tool.shortcut === "4") return (
    <svg width="120" height="60" viewBox="0 0 120 60">
      <motion.line
        x1="10" y1="50" x2="110" y2="10"
        stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5 }}
      />
    </svg>
  );

  // For Arrow
  if (tool.shortcut === "5") return (
    <svg width="120" height="60" viewBox="0 0 120 60">
      <defs>
        <marker id="ph-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
        </marker>
      </defs>
      <motion.line
        x1="10" y1="50" x2="105" y2="10"
        stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"
        markerEnd="url(#ph-arrow)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5 }}
      />
    </svg>
  );

  // For Text
  if (tool.shortcut === "6") return (
    <motion.p
      className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      Hello!<motion.span animate={{ opacity: [1,0,1] }} transition={{ duration: 0.8, repeat: Infinity }}>|</motion.span>
    </motion.p>
  );

  // For Freehand
  if (tool.shortcut === "7") return (
    <svg width="120" height="80" viewBox="0 0 120 80">
      <motion.path
        d="M10,60 C25,20 45,70 65,30 C85,-10 100,60 115,40"
        fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
    </svg>
  );

  // For Eraser
  if (tool.shortcut === "8") return (
    <div className="relative w-28 h-20 flex items-center justify-center">
      <div className="w-20 h-14 rounded bg-gray-200 dark:bg-white/10 border border-gray-300 dark:border-white/20 overflow-hidden relative">
        <div className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, #e5e7eb 0, #e5e7eb 1px, transparent 0, transparent 50%)",
            backgroundSize: "8px 8px",
          }}
        />
        <motion.div
          className="absolute left-0 top-0 h-full bg-white dark:bg-[#0a0a0a]"
          initial={{ width: 0 }}
          animate={{ width: "70%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="absolute bottom-0 right-3 flex items-center gap-1 opacity-70">
        <Icon className="w-4 h-4 text-gray-500 dark:text-white/40" />
      </div>
    </div>
  );

  // Fallback
  return <Icon className="w-12 h-12 text-indigo-400 opacity-50" />;
}
