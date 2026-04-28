"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { PenTool, Users, Sparkles } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    number: "01",
    icon: PenTool,
    title: "Create a canvas",
    description: "Start with a blank infinite canvas or choose from templates",
    color: "from-blue-400 to-cyan-400",
  },
  {
    number: "02",
    icon: Users,
    title: "Draw or invite others",
    description:
      "Sketch ideas yourself or collaborate in real-time with your team",
    color: "from-purple-400 to-pink-400",
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Use AI to accelerate",
    description:
      "Let AI generate diagrams, refine layouts, and enhance your work",
    color: "from-indigo-400 to-purple-400",
  },
];

export function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section id="how-it-works" ref={ref} className="py-32 px-6 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60 bg-clip-text text-transparent">
            How it works
          </h2>
          <p className="text-xl text-gray-600 dark:text-white/60 max-w-2xl mx-auto">
            Three simple steps to transform how you visualize ideas
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-24 left-1/2 -translate-x-1/2 w-[80%] h-0.5">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400"
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.5, delay: 0.5 }}
              style={{ transformOrigin: "left" }}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            {steps.map((step, index) => (
              <StepCard
                key={step.number}
                step={step}
                index={index}
                isInView={isInView}
              />
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.5 }}
          className="text-center mt-20"
        >
          <p className="text-gray-600 dark:text-white/60 text-lg mb-6">
            Ready to start? It takes less than a minute.
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-white font-semibold text-lg"
            >
              Get Started Free
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function StepCard({
  step,
  index,
  isInView,
}: {
  step: (typeof steps)[0];
  index: number;
  isInView: boolean;
}) {
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.2 }}
      className="relative flex flex-col items-center text-center"
    >
      {/* Number badge */}
      <motion.div
        className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center mb-6`}
        initial={{ scale: 0 }}
        animate={isInView ? { scale: 1 } : {}}
        transition={{ duration: 0.5, delay: index * 0.2 + 0.3, type: "spring" }}
      >
        <motion.div
          className={`absolute inset-0 rounded-full bg-gradient-to-br ${step.color} blur-xl opacity-50`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: index * 0.3,
          }}
        />
        <Icon className="w-8 h-8 text-white relative z-10" />
      </motion.div>

      {/* Step number */}
      <motion.div
        className="text-6xl font-bold bg-gradient-to-br from-gray-300 to-gray-100 dark:from-white/20 dark:to-white/5 bg-clip-text text-transparent mb-4"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: index * 0.2 + 0.5 }}
      >
        {step.number}
      </motion.div>

      {/* Content */}
      <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">
        {step.title}
      </h3>
      <p className="text-gray-600 dark:text-white/60 leading-relaxed max-w-xs">
        {step.description}
      </p>

      {/* Decorative dots */}
      <div className="flex gap-2 mt-6">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className={`w-2 h-2 rounded-full bg-gradient-to-r ${step.color}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={isInView ? { opacity: 0.6, scale: 1 } : {}}
            transition={{ delay: index * 0.2 + 0.7 + i * 0.1 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
