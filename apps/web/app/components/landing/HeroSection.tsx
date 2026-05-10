"use client";

import { motion, useScroll, useTransform, Variants } from "motion/react";
import { Sparkles, ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useRef, useEffect, useState } from "react";

export function HeroSection() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden pb-12 pt-28 sm:pt-24"
    >
      {/* Dynamic Background Glows */}
      {mounted && (
        <motion.div
          className="absolute inset-0 z-0 opacity-40 dark:opacity-50 pointer-events-none"
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.25) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 50%, rgba(168, 85, 247, 0.25) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.25) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Structural Grid Background */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[48px_48px]" />

      {/* Floating Boxy Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div
          animate={{ y: [0, -30, 0], rotate: [-6, 2, -6] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-10 w-24 h-24 border-2 border-indigo-300 dark:border-indigo-400 bg-indigo-100/50 dark:bg-indigo-500/40 backdrop-blur-md shadow-lg shadow-indigo-500/20"
        />
        <motion.div
          animate={{ y: [0, 40, 0], rotate: [12, -4, 12] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute bottom-1/4 right-12 w-32 h-32 border-2 border-emerald-300 dark:border-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/40 backdrop-blur-md shadow-lg shadow-emerald-500/20"
        />
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [45, 60, 45] }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute top-1/3 right-1/4 w-16 h-16 border-2 border-purple-300 dark:border-purple-400 bg-purple-100/50 dark:bg-purple-500/40 backdrop-blur-md shadow-lg shadow-purple-500/20"
        />
        <motion.div
          animate={{ y: [0, 25, 0], rotate: [-15, 10, -15] }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
          className="absolute bottom-1/3 left-1/4 w-20 h-20 border-2 border-pink-300 dark:border-pink-400 bg-pink-100/50 dark:bg-pink-500/40 backdrop-blur-md shadow-lg shadow-pink-500/20"
        />
      </div>

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ opacity, y }}
        className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6"
      >
        <motion.div variants={itemVariants} className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 dark:bg-white/10 border border-slate-200 dark:border-white/20 shadow-lg backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-white/90">
              AI-Powered Infinite Canvas
            </span>
          </div>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="mb-6 text-5xl font-black leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-7xl md:text-8xl md:leading-[1.05]"
        >
          Think. Draw. Build
          <br />
          <span className="relative inline-block mt-2">
            <span className="relative z-10 bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              in real time.
            </span>
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mb-10 max-w-3xl text-base font-medium text-slate-600 dark:text-slate-300 sm:text-xl md:mb-12 md:text-2xl"
        >
          A collaborative infinite canvas with AI built in.
          <br />
          Ideas shouldn&apos;t stay invisible.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-5 justify-center items-center w-full sm:w-auto"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto"
          >
            <Link
              href="/signin"
              className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl text-white font-bold text-lg overflow-hidden shadow-xl shadow-indigo-500/25 w-full sm:w-auto transition-shadow hover:shadow-indigo-500/40"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <span className="relative z-10 flex items-center gap-2">
                Start Drawing
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.span>
              </span>
            </Link>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto"
          >
            <Link
              href="/signup"
              className="flex items-center justify-center gap-3 px-8 py-4 bg-white/90 dark:bg-white/10 backdrop-blur-md border-2 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white rounded-xl font-bold text-lg hover:bg-white dark:hover:bg-white/20 transition-colors shadow-lg w-full sm:w-auto"
            >
              <Play className="w-5 h-5" />
              Sign Up Free
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
