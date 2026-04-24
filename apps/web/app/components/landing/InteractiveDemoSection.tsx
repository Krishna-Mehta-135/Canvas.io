"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Sparkles, Terminal } from "lucide-react";
import { InteractiveCanvas } from "./InteractiveCanvas";
import { useRouter } from "next/navigation";

const collaborators = [
  { name: "Sarah C.", color: "bg-indigo-600" },
  { name: "Mike T.", color: "bg-emerald-600" },
  { name: "Alex R.", color: "bg-rose-600" },
];

export function InteractiveDemoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const router = useRouter();

  return (
    <section id="demo" ref={ref} className="py-24 px-6 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
        >
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">
              See it in action.
            </h2>
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
              A collaborative space that feels like a native app. 
              No spinners, no loading bars. Just immediate visual feedback.
            </p>
          </div>
        </motion.div>

        {/* Structural Canvas Container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative bg-white dark:bg-[#0a0f1a] border-2 border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0f172a] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>
              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight">System Architecture</span>
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
                    className={`w-7 h-7 ${person.color} rounded-md border-2 border-white dark:border-[#0a0f1a] flex items-center justify-center text-white text-[10px] font-bold`}
                    title={person.name}
                  >
                    {person.name.split(' ')[0]![0]}{person.name.split(' ')[1]![0]}
                  </motion.div>
                ))}
              </div>
              <motion.button
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Share
              </motion.button>
            </div>
          </div>

          {/* Terminal / Prompt Bar */}
          <div className="bg-white dark:bg-[#0a0f1a] p-4 border-b border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center gap-3 max-w-3xl mx-auto bg-slate-50 dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-slate-700/50 p-2">
              <Terminal className="w-4 h-4 text-slate-400 dark:text-slate-500 ml-2" />
              <input
                type="text"
                placeholder="> generate api gateway flow with rate limiting"
                className="flex-1 bg-transparent text-sm font-mono text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none"
                readOnly
              />
              <motion.button
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-md flex items-center gap-2 transition-colors"
                onClick={() => router.push('/signin')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Sparkles className="w-3 h-3" />
                Run
              </motion.button>
            </div>
          </div>

          {/* Interactive Canvas */}
          <div className="p-6 bg-indigo-50/50 dark:bg-[#0a0f1a] bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] h-[500px] relative">
            <InteractiveCanvas />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
