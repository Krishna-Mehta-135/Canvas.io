"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { Menu, X, Pencil, Sun, Moon } from "lucide-react";
import { useTheme } from "../ThemeProvider";
import Link from "next/link";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [ripple, setRipple] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleToggle = () => {
    setRipple(true);
    toggleTheme();
    setTimeout(() => setRipple(false), 700);
  };

  return (
    <>
      {/* Ripple flash overlay on theme change */}
      <AnimatePresence>
        {ripple && (
          <motion.div
            key="ripple"
            className="fixed inset-0 z-[200] pointer-events-none"
            style={{
              background: theme === "dark"
                ? "radial-gradient(circle at top right, rgba(255,255,255,0.15) 0%, transparent 70%)"
                : "radial-gradient(circle at top right, rgba(0,0,0,0.12) 0%, transparent 70%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/10 shadow-sm"
            : "bg-transparent"
        }`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <Pencil className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Canvas<span className="text-indigo-500">.io</span>
              </span>
            </Link>
          </motion.div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-white/60">
            {["Features", "Pricing", "Docs", "Blog"].map((item) => (
              <motion.a
                key={item}
                href="#"
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
                whileHover={{ y: -1 }}
              >
                {item}
              </motion.a>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <motion.button
              onClick={handleToggle}
              className="relative p-2.5 rounded-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors overflow-hidden"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              aria-label="Toggle theme"
            >
              <AnimatePresence mode="wait">
                {theme === "dark" ? (
                  <motion.div
                    key="moon"
                    initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Moon className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="sun"
                    initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Sun className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Sign In */}
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="hidden md:block">
              <Link
                href="/signin"
                className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Sign in
              </Link>
            </motion.div>

            {/* Get Started */}
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="hidden md:block">
              <Link
                href="/signup"
                className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold rounded-full shadow-md hover:shadow-indigo-500/30 transition-shadow"
              >
                Get Started
              </Link>
            </motion.div>

            {/* Mobile hamburger */}
            <motion.button
              className="md:hidden p-2 text-gray-700 dark:text-white/70"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              whileTap={{ scale: 0.9 }}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
          </div>
        </nav>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden overflow-hidden bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/10"
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                {["Features", "Pricing", "Docs", "Blog"].map((item) => (
                  <a key={item} href="#" className="text-gray-700 dark:text-white/70 font-medium py-1">
                    {item}
                  </a>
                ))}
                <div className="border-t border-gray-200 dark:border-white/10 pt-4 flex flex-col gap-3">
                  <Link href="/signin" className="text-center py-2.5 border border-gray-300 dark:border-white/20 rounded-xl text-gray-800 dark:text-white font-semibold">
                    Sign in
                  </Link>
                  <Link href="/signup" className="text-center py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold">
                    Get Started Free
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
}
