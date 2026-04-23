"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Sparkles } from "lucide-react";
import { InteractiveCanvas } from "./InteractiveCanvas";
import { useRouter } from "next/navigation";

const collaborators = [
  { name: "Sarah C.", color: "bg-purple-500" },
  { name: "Mike T.", color: "bg-green-500" },
  { name: "Alex R.", color: "bg-blue-500" },
];

export function InteractiveDemoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const router = useRouter();

  return (
    <section ref={ref} className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60 bg-clip-text text-transparent">
            See it in action
          </h2>
          <p className="text-xl text-gray-600 dark:text-white/60 max-w-2xl mx-auto">
            Watch ideas come to life with real-time collaboration and AI assistance
          </p>
        </motion.div>

        {/* Canvas Demo Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative rounded-3xl overflow-hidden bg-white dark:bg-[#0d0d0d] border border-gray-200 dark:border-white/10 shadow-2xl"
        >
          {/* Glow effect */}
          <motion.div
            className="absolute -inset-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 blur-xl"
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* Header Bar */}
          <div className="relative bg-white/90 dark:bg-[#0a0a0a]/50 backdrop-blur-md border-b border-gray-200 dark:border-white/10 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-gray-900 dark:text-white font-medium">System Architecture Design</span>
                <span className="text-xs text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded">Saved</span>
              </div>

              {/* Collaborator Avatars */}
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {collaborators.map((person, i) => (
                    <motion.div
                      key={person.name}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={isInView ? { opacity: 1, scale: 1 } : {}}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className={`w-8 h-8 ${person.color} rounded-full border-2 border-white dark:border-[#0a0a0a] flex items-center justify-center text-white text-xs font-semibold`}
                      title={person.name}
                    >
                      {person.name.split(' ')[0]![0]}{person.name.split(' ')[1]![0]}
                    </motion.div>
                  ))}
                </div>
                <motion.button
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Share
                </motion.button>
              </div>
            </div>
          </div>

          {/* AI Prompt Bar */}
          <motion.div
            className="relative bg-gray-100/50 dark:bg-[#0a0a0a]/30 backdrop-blur-sm px-6 py-4 border-b border-gray-200 dark:border-white/5"
            initial={{ opacity: 0, y: -10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.8 }}
          >
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
              <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Generate a diagram for an API Gateway rate limiting system"
                className="flex-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/40 focus:outline-none focus:border-indigo-500/50 transition-colors"
                readOnly
              />
              <motion.button
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl flex items-center gap-2 transition-colors"
                onClick={() => router.push('/signin')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Sparkles className="w-4 h-4" />
                Generate
              </motion.button>
            </div>
          </motion.div>

          {/* Interactive Canvas */}
          <div className="p-6 bg-gray-50 dark:bg-[#0a0a0a]">
            <InteractiveCanvas />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
