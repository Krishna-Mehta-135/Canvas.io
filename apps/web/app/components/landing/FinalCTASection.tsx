"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function FinalCTASection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <section ref={ref} className="py-32 px-6 relative overflow-hidden">
      {/* Animated background */}
      <motion.div
        className="absolute inset-0 opacity-20 dark:opacity-40"
        animate={{
          background: [
            "radial-gradient(circle at 30% 50%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 70% 50%, rgba(168, 85, 247, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 30% 50%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7 }}
          className="relative"
        >
          {/* Glow orbs */}
          <motion.div
            className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500 rounded-full blur-[100px] opacity-50"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.7, 0.5],
            }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500 rounded-full blur-[100px] opacity-50"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.5, 0.7, 0.5],
            }}
            transition={{ duration: 4, repeat: Infinity }}
          />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-6xl md:text-7xl font-bold mb-8">
              <span className="bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60 bg-clip-text text-transparent">
                Start building
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                visually.
              </span>
            </h2>

            <motion.p
              className="text-2xl text-gray-600 dark:text-white/60 mb-12 max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4 }}
            >
              Draw faster. Think clearer. Collaborate better.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  href="/signup"
                  className="group relative inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-white font-semibold text-xl overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400"
                    initial={{ x: "100%" }}
                    whileHover={{ x: "0%" }}
                    transition={{ duration: 0.3 }}
                  />
                  <span className="relative z-10 flex items-center gap-2">
                    Get Started
                    <motion.span
                      className="inline-block"
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ArrowRight className="w-5 h-5" />
                    </motion.span>
                  </span>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-white/50"
                    animate={{ scale: [1, 1.1, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  />
                </Link>
              </motion.div>

              <motion.div
                className="text-gray-500 dark:text-white/40 text-sm"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.8 }}
              >
                Free forever • No credit card required
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Floating particles */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-gray-400/30 dark:bg-white/30 rounded-full"
              style={{
                left: `${(i * 6.7) % 100}%`,
                top: `${(i * 9.3) % 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.3, 0.7, 0.3],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 2 + (i % 3),
                repeat: Infinity,
                delay: (i % 5) * 0.4,
              }}
            />
          ))}
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1 }}
          className="mt-20 flex flex-wrap justify-center gap-8 text-gray-500 dark:text-white/40 text-sm"
        >
          {[
            "10,000+ teams",
            "99.9% uptime",
            "SOC 2 certified",
            "24/7 support",
          ].map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 1.2 + i * 0.1 }}
              className="flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 bg-green-500 dark:bg-green-400 rounded-full" />
              {item}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
