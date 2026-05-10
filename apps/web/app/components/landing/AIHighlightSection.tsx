"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  Database,
  Server,
  User,
  Box,
} from "lucide-react";

export function AIHighlightSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const [typedText, setTypedText] = useState("");
  const [showResult, setShowResult] = useState(false);
  const fullText = "System design for chat app";

  useEffect(() => {
    if (!isInView) return;

    let index = 0;
    const typingInterval = setInterval(() => {
      if (index <= fullText.length) {
        setTypedText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(typingInterval);
        setTimeout(() => setShowResult(true), 500);
      }
    }, 80);

    return () => clearInterval(typingInterval);
  }, [isInView]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-white px-4 py-24 dark:bg-[#070b14] sm:px-6"
    >
      {/* Structural Background Pattern */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 mb-6 shadow-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[11px] uppercase tracking-widest font-bold text-indigo-900 dark:text-indigo-300">
              AI-Powered Generation
            </span>
          </motion.div>

          <h2 className="mb-6 text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-6xl">
            From prompt to visual
            <br />
            <span className="text-indigo-600 dark:text-indigo-400">
              in seconds.
            </span>
          </h2>
          <p className="text-lg md:text-xl font-medium text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Describe what you need, and watch our AI co-pilot construct
            structural, editable geometry instantly.
          </p>
        </motion.div>

        {/* Transformation Demo */}
        <div className="mx-auto grid max-w-5xl gap-6 items-center lg:grid-cols-[1fr_auto_1.5fr] lg:gap-8">
          {/* Input Side */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative w-full"
          >
            <div className="bg-white dark:bg-[#0a0f1a] border-2 border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-black/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
                  <Sparkles className="w-4 h-4" />
                  Prompt
                </div>
              </div>
              <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <span className="text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                  {">"}
                </span>
                <div className="flex-1 font-mono text-sm text-slate-800 dark:text-slate-300">
                  <span>{typedText}</span>
                  <motion.span
                    className="inline-block w-1.5 h-4 bg-indigo-500 dark:bg-indigo-400 ml-1 translate-y-0.5"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Arrow */}
          <motion.div
            className="flex items-center justify-center lg:hidden"
            initial={{ opacity: 0, scale: 0 }}
            animate={showResult ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <ArrowRight className="h-8 w-8 rotate-90 text-indigo-400 dark:text-indigo-600" />
            </motion.div>
          </motion.div>
          <motion.div
            className="hidden items-center justify-center lg:flex"
            initial={{ opacity: 0, scale: 0 }}
            animate={showResult ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              animate={{ x: [0, 8, 0] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <ArrowRight className="w-8 h-8 text-indigo-400 dark:text-indigo-600" />
            </motion.div>
          </motion.div>

          {/* Output Side */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={showResult ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6 }}
            className="relative w-full"
          >
            <div className="bg-white dark:bg-[#0a0f1a] border-2 border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-black/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500" />
              <div className="flex items-center gap-2 mb-6 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
                <Box className="w-4 h-4 text-emerald-500" />
                Generated Output
              </div>

              {/* Structural Generated Diagram */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-6 min-h-[240px] relative flex flex-col items-center justify-center gap-8 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px]">
                {/* Flow Layout */}
                <div className="relative z-10 flex w-full flex-col items-center gap-5 justify-center sm:flex-row sm:gap-8">
                  {/* Client */}
                  <motion.div
                    className="flex flex-col items-center gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={showResult ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="w-20 h-16 bg-blue-50/80 dark:bg-slate-800 border-2 border-blue-400 dark:border-blue-500 rounded-lg flex flex-col items-center justify-center shadow-sm">
                      <User className="w-5 h-5 text-blue-500 mb-1" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
                      Client
                    </span>
                  </motion.div>

                  {/* Arrow 1 */}
                  <motion.div
                    className="relative h-10 w-0.5 bg-slate-300 dark:bg-slate-600 sm:-mt-6 sm:h-0.5 sm:w-16"
                    initial={{ scaleX: 0 }}
                    animate={showResult ? { scaleX: 1, scaleY: 1 } : {}}
                    transition={{ delay: 0.3 }}
                    style={{ originX: 0, originY: 0 }}
                  >
                    <div className="absolute -bottom-0.5 -left-[5px] h-0 w-0 border-x-4 border-t-[6px] border-x-transparent border-t-slate-300 dark:border-t-slate-600 sm:-right-0 sm:-top-1 sm:left-auto sm:bottom-auto sm:border-b-4 sm:border-l-[6px] sm:border-r-0 sm:border-t-4 sm:border-b-transparent sm:border-l-slate-300 sm:border-t-transparent dark:sm:border-l-slate-600" />
                  </motion.div>

                  {/* Server */}
                  <motion.div
                    className="flex flex-col items-center gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={showResult ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="w-24 h-16 bg-indigo-50/80 dark:bg-slate-800 border-2 border-indigo-400 dark:border-indigo-500 rounded-lg flex flex-col items-center justify-center shadow-sm">
                      <Server className="w-5 h-5 text-indigo-500 mb-1" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
                      Server
                    </span>
                  </motion.div>

                  {/* Arrow 2 */}
                  <motion.div
                    className="relative h-10 w-0.5 bg-slate-300 dark:bg-slate-600 sm:-mt-6 sm:h-0.5 sm:w-16"
                    initial={{ scaleX: 0 }}
                    animate={showResult ? { scaleX: 1, scaleY: 1 } : {}}
                    transition={{ delay: 0.7 }}
                    style={{ originX: 0, originY: 0 }}
                  >
                    <div className="absolute -bottom-0.5 -left-[5px] h-0 w-0 border-x-4 border-t-[6px] border-x-transparent border-t-slate-300 dark:border-t-slate-600 sm:-right-0 sm:-top-1 sm:left-auto sm:bottom-auto sm:border-b-4 sm:border-l-[6px] sm:border-r-0 sm:border-t-4 sm:border-b-transparent sm:border-l-slate-300 sm:border-t-transparent dark:sm:border-l-slate-600" />
                  </motion.div>

                  {/* Database */}
                  <motion.div
                    className="flex flex-col items-center gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={showResult ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.9 }}
                  >
                    <div className="w-20 h-16 bg-emerald-50/80 dark:bg-slate-800 border-2 border-emerald-400 dark:border-emerald-500 rounded-lg flex flex-col items-center justify-center shadow-sm">
                      <Database className="w-5 h-5 text-emerald-500 mb-1" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
                      Database
                    </span>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 text-center max-w-4xl mx-auto"
        >
          {[
            { value: "< 3s", label: "Average generation time" },
            { value: "50+", label: "Diagram types supported" },
            { value: "99.9%", label: "Accuracy rate" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 1.7 + i * 0.1 }}
              className="p-4"
            >
              <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                {stat.value}
              </div>
              <div className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
