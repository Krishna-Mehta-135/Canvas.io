"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Infinity as InfinityIcon, Users, Sparkles, Lock, Share2, Zap } from "lucide-react";

const features = [
  {
    icon: InfinityIcon,
    title: "Infinite Canvas",
    description: "Never run out of space. Zoom, pan, and create without limits.",
    color: "from-blue-400 to-cyan-400",
  },
  {
    icon: Users,
    title: "Real-time Collaboration",
    description: "See cursors, edits, and ideas appear instantly across your team.",
    color: "from-purple-400 to-pink-400",
  },
  {
    icon: Sparkles,
    title: "AI Drawing Assistant",
    description: "Transform text prompts into diagrams, flows, and visual concepts.",
    color: "from-indigo-400 to-purple-400",
  },
  {
    icon: Zap,
    title: "Persistent Workspaces",
    description: "Auto-save everything. Pick up exactly where you left off.",
    color: "from-yellow-400 to-orange-400",
  },
  {
    icon: Lock,
    title: "Secure Sharing",
    description: "Control who sees what with granular permissions and access links.",
    color: "from-green-400 to-emerald-400",
  },
  {
    icon: Share2,
    title: "Export Anywhere",
    description: "Download as PNG, SVG, or share live links with stakeholders.",
    color: "from-rose-400 to-pink-400",
  },
];

export function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section ref={ref} className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60 bg-clip-text text-transparent">
            Built for modern teams
          </h2>
          <p className="text-xl text-gray-600 dark:text-white/60 max-w-2xl mx-auto">
            Everything you need to think visually and collaborate seamlessly
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              index={index}
              isInView={isInView}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
  index,
  isInView,
}: {
  feature: typeof features[0];
  index: number;
  isInView: boolean;
}) {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="group relative"
    >
      <div className="relative h-full bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-8 overflow-hidden transition-all duration-300">
        {/* Hover glow effect */}
        <motion.div
          className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500`}
        />

        {/* Border glow on hover */}
        <motion.div
          className={`absolute inset-0 border-2 border-transparent bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-20 rounded-2xl`}
          style={{ mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)" }}
        />

        <div className="relative z-10">
          {/* Icon */}
          <motion.div
            className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-6`}
            whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
            transition={{ duration: 0.5 }}
          >
            <Icon className="w-6 h-6 text-white" />
          </motion.div>

          {/* Content */}
          <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white group-hover:text-gray-800 dark:group-hover:text-white/90 transition-colors">
            {feature.title}
          </h3>
          <p className="text-gray-600 dark:text-white/60 leading-relaxed">{feature.description}</p>
        </div>

        {/* Decorative corner accent */}
        <motion.div
          className={`absolute -bottom-2 -right-2 w-24 h-24 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 rounded-full blur-2xl transition-opacity duration-500`}
        />
      </div>
    </motion.div>
  );
}
