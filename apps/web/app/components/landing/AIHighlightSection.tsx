"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState, useEffect } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

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
    <section ref={ref} className="py-32 px-6 relative overflow-hidden">
      {/* Background accent */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-indigo-400/15 via-purple-400/15 to-pink-400/15 dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-pink-500/20 rounded-full blur-[120px]"
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 dark:border-indigo-500/30 mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">AI-Powered</span>
          </motion.div>

          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60 bg-clip-text text-transparent">
            From prompt to visual
            <br />
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              in seconds
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-white/60 max-w-2xl mx-auto">
            Describe what you need, and watch AI generate professional diagrams instantly
          </p>
        </motion.div>

        {/* Transformation Demo */}
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Input Side */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative"
          >
            <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center gap-2 mb-4 text-gray-600 dark:text-white/60 text-sm">
                <Sparkles className="w-4 h-4" />
                AI Prompt
              </div>
              <div className="flex items-center gap-3 bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                <div className="flex-1 font-medium text-gray-900 dark:text-white">
                  <span>{typedText}</span>
                  <motion.span
                    className="inline-block w-0.5 h-5 bg-indigo-500 dark:bg-indigo-400 ml-1"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Arrow */}
          <motion.div
            className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-20"
            initial={{ opacity: 0, scale: 0 }}
            animate={showResult ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              animate={{ x: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight className="w-12 h-12 text-indigo-400" />
            </motion.div>
          </motion.div>

          {/* Output Side */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={showResult ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-8 overflow-hidden shadow-xl">
              <div className="flex items-center gap-2 mb-4 text-gray-600 dark:text-white/60 text-sm">
                <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                AI generated
              </div>

              {/* Generated Diagram */}
              <div className="bg-gray-100 dark:bg-black/40 rounded-xl p-6 min-h-[240px] relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 400 200">
                  {/* Client Box */}
                  <motion.g
                    initial={{ opacity: 0, y: 20 }}
                    animate={showResult ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.2 }}
                  >
                    <rect x="20" y="80" width="80" height="40" rx="8" fill="url(#grad1)" />
                    <text x="60" y="105" textAnchor="middle" fill="white" fontSize="12">
                      Client
                    </text>
                  </motion.g>

                  {/* Server Box */}
                  <motion.g
                    initial={{ opacity: 0, y: 20 }}
                    animate={showResult ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.4 }}
                  >
                    <rect x="160" y="80" width="80" height="40" rx="8" fill="url(#grad2)" />
                    <text x="200" y="105" textAnchor="middle" fill="white" fontSize="12">
                      Server
                    </text>
                  </motion.g>

                  {/* Database Box */}
                  <motion.g
                    initial={{ opacity: 0, y: 20 }}
                    animate={showResult ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.6 }}
                  >
                    <rect x="300" y="80" width="80" height="40" rx="8" fill="url(#grad3)" />
                    <text x="340" y="105" textAnchor="middle" fill="white" fontSize="12">
                      Database
                    </text>
                  </motion.g>

                  {/* Arrows */}
                  <motion.path
                    d="M 100 100 L 160 100"
                    stroke="#6366f1"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    initial={{ pathLength: 0 }}
                    animate={showResult ? { pathLength: 1 } : {}}
                    transition={{ delay: 0.8, duration: 0.5 }}
                  />
                  <motion.path
                    d="M 240 100 L 300 100"
                    stroke="#a855f7"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    initial={{ pathLength: 0 }}
                    animate={showResult ? { pathLength: 1 } : {}}
                    transition={{ delay: 1, duration: 0.5 }}
                  />

                  <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                    <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3, 0 6" fill="#6366f1" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.5 }}
          className="grid grid-cols-3 gap-8 mt-20 text-center"
        >
          {[
            { value: "< 3s", label: "Average generation time" },
            { value: "50+", label: "Diagram types supported" },
            { value: "99.9%", label: "Accuracy rate" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 1.7 + i * 0.1 }}
            >
              <div className="text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-gray-600 dark:text-white/60 text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
