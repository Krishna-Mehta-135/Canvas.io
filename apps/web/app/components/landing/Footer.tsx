"use client";

import { motion } from "motion/react";

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-gray-200 dark:border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 4L16 16M4 16L16 4"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">Canvas</span>
          </motion.div>

          {/* Links */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap justify-center gap-8 text-sm text-gray-600 dark:text-white/60"
          >
            {["Product", "Features", "Pricing", "Docs", "Blog", "Support"].map(
              (link) => (
                <motion.a
                  key={link}
                  href="#"
                  className="hover:text-gray-900 dark:hover:text-white transition-colors"
                  whileHover={{ y: -2 }}
                >
                  {link}
                </motion.a>
              )
            )}
          </motion.div>

          {/* Copyright */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-sm text-gray-500 dark:text-white/40"
          >
            © 2026 Canvas. All rights reserved.
          </motion.div>
        </div>

        {/* Subtle divider */}
        <motion.div
          className="mt-8 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        />
      </div>
    </footer>
  );
}
