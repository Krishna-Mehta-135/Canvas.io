"use client";

import { motion } from "motion/react";
import { Sun, Moon } from "lucide-react";
import { useLandingTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useLandingTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      className="fixed top-6 right-6 z-50 p-3 bg-white/10 dark:bg-white/10 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-full shadow-lg"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{ rotate: theme === "dark" ? 0 : 180 }}
        transition={{ duration: 0.3 }}
      >
        {theme === "dark" ? (
          <Moon className="w-5 h-5 text-white" />
        ) : (
          <Sun className="w-5 h-5 text-gray-900" />
        )}
      </motion.div>
    </motion.button>
  );
}
