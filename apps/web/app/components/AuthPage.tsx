"use client";

/* File intent: Landing-style sign-in and sign-up surface for Canvas access. */

import { useState, FormEvent, useEffect } from "react";
import { AxiosError } from "axios";
import { ArrowRight, Eye, EyeOff, LayoutGrid, Layers3, Loader2, Moon, ShieldCheck, Sparkles, Sun, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { HTTP_BACKEND } from "../../config";
import { apiClient } from "../lib/apiClient";
import { useTheme } from "./ThemeProvider";

const API_BASE = HTTP_BACKEND;

const AUTH_FEATURES = [
    {
        icon: Layers3,
        title: "Instant setup",
        description: "Jump into a workspace in seconds.",
    },
    {
        icon: Users,
        title: "Team ready",
        description: "Share canvases without extra friction.",
    },
    {
        icon: ShieldCheck,
        title: "Secure access",
        description: "Keep rooms private and organized.",
    },
    {
        icon: Sparkles,
        title: "AI assisted",
        description: "Turn prompts into structured ideas.",
    },
] as const;

interface AuthPageProps {
    isSignIn: boolean;
}

export function AuthPage({ isSignIn }: AuthPageProps) {
    const searchParams = useSearchParams();
    const { theme, toggleTheme } = useTheme();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isUnmounted = false;
        const checkExistingSession = async () => {
            try {
                await apiClient.get(`${API_BASE}/auth/current-user`);
                if (isUnmounted) return;
                const redirectTarget = searchParams.get("redirect");
                window.location.href = redirectTarget && redirectTarget.length > 0 ? redirectTarget : "/rooms";
            } catch {
                if (!isUnmounted) setCheckingSession(false);
            }
        };
        void checkExistingSession();
        return () => { isUnmounted = true; };
    }, [searchParams]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const endpoint = isSignIn ? `${API_BASE}/auth/signin` : `${API_BASE}/auth/signup`;
            const payload = isSignIn ? { email, password } : { name, email, password };
            await apiClient.post(endpoint, payload);
            const redirectTarget = searchParams.get("redirect");
            if (redirectTarget) { window.location.href = redirectTarget; return; }
            window.location.href = "/rooms";
        } catch (err) {
            const axiosError = err as AxiosError<{ message: string }>;
            const message =
                axiosError.response?.data?.message ||
                (isSignIn ? "Invalid email or password." : "Something went wrong. Please try again.");
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center transition-colors duration-300">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 text-gray-500 dark:text-white/60 text-sm"
                >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking session…
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_15%,rgba(59,130,246,0.22),transparent_40%),radial-gradient(circle_at_80%_12%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.12),transparent_60%),linear-gradient(180deg,#edf4ff_0%,#ffffff_45%,#f0f7ff_100%)] text-gray-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,246,0.20),transparent_30%),radial-gradient(circle_at_82%_10%,rgba(139,92,246,0.16),transparent_24%),linear-gradient(180deg,#0f172a_0%,#020617_70%,#020617_100%)] dark:text-white">
            {/* Animated background gradients — subtle in light, vivid in dark */}
            <motion.div
                className="fixed inset-0 pointer-events-none"
                animate={{
                    background: [
                        "radial-gradient(circle at 20% 50%, rgba(99,102,241,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.1) 0%, transparent 50%)",
                        "radial-gradient(circle at 80% 50%, rgba(168,85,247,0.12) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(99,102,241,0.1) 0%, transparent 50%)",
                        "radial-gradient(circle at 20% 50%, rgba(99,102,241,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.1) 0%, transparent 50%)",
                    ],
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />
            {/* Subtle grid */}
            <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(100,100,100,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(100,100,100,0.06)_1px,transparent_1px)] bg-size-[64px_64px] dark:bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)]" />

            {/* Header */}
            <motion.header
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5"
            >
                <Link href="/" className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-[10px] flex items-center justify-center shadow-sm">
                        <LayoutGrid className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[28px] font-black text-slate-900 dark:text-white tracking-tighter">
                        Canvas.
                    </span>
                </Link>
                <div className="flex items-center gap-4">
                    {/* Theme toggle */}
                    <motion.button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.92 }}
                        aria-label="Toggle theme"
                    >
                        <AnimatePresence mode="wait">
                            {theme === "dark" ? (
                                <motion.div key="moon" initial={{ opacity: 0, rotate: -90, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 90, scale: 0.5 }} transition={{ duration: 0.2 }}>
                                    <Moon className="w-4 h-4" />
                                </motion.div>
                            ) : (
                                <motion.div key="sun" initial={{ opacity: 0, rotate: 90, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: -90, scale: 0.5 }} transition={{ duration: 0.2 }}>
                                    <Sun className="w-4 h-4" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.button>

                    <Link
                        href={isSignIn ? "/signup" : "/signin"}
                        className="text-sm text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
                    >
                        {isSignIn ? (
                            <>No account? <span className="text-indigo-500 dark:text-indigo-400 font-semibold">Sign up</span></>
                        ) : (
                            <>Have an account? <span className="text-indigo-500 dark:text-indigo-400 font-semibold">Sign in</span></>
                        )}
                    </Link>
                </div>
            </motion.header>

            {/* Main */}
            <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="w-full max-w-2xl"
                >
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 mb-6"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span className="text-xs text-gray-600 dark:text-white/60">AI-Powered Infinite Canvas</span>
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="mb-8"
                    >
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                            {isSignIn ? "Welcome back" : "Get started"}
                        </h1>
                        <p className="text-gray-500 dark:text-white/50 text-base leading-relaxed">
                            {isSignIn
                                ? "Sign in to continue building on your canvas."
                                : "Join thousands of teams sketching together."}
                        </p>
                    </motion.div>

                    <div className="grid gap-3 sm:grid-cols-2 mb-8">
                        {AUTH_FEATURES.map((feature, index) => {
                            const FeatureIcon = feature.icon;

                            return (
                                <motion.div
                                    key={feature.title}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.18 + index * 0.06 }}
                                    className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-white/3"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
                                            <FeatureIcon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{feature.title}</p>
                                            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-white/55">{feature.description}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-4xl border border-slate-200/80 bg-white/88 p-8 shadow-[0_28px_100px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/4 dark:shadow-none"
                    >
                        {/* Error */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: "auto" }}
                                    exit={{ opacity: 0, y: -8, height: 0 }}
                                    className="mb-5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Name */}
                            {!isSignIn && (
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
                                        Full name
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        autoComplete="name"
                                        placeholder="Jane Smith"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 text-sm transition-all outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/15 hover:border-gray-300 dark:hover:border-white/20"
                                    />
                                </div>
                            )}

                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-1.5">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="jane@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 text-sm transition-all outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/15 hover:border-gray-300 dark:hover:border-white/20"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-white/70">
                                        Password
                                    </label>
                                    {isSignIn && (
                                        <a href="/forgot-password" className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors">
                                            Forgot password?
                                        </a>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete={isSignIn ? "current-password" : "new-password"}
                                        placeholder={isSignIn ? "Your password" : "At least 8 characters"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={isSignIn ? undefined : 8}
                                        className="w-full px-4 py-3 pr-11 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 text-sm transition-all outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/15 hover:border-gray-300 dark:hover:border-white/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((p) => !p)}
                                        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {!isSignIn && (
                                    <p className="mt-1.5 text-xs text-gray-400 dark:text-white/30">Must be at least 8 characters.</p>
                                )}
                            </div>

                            {/* Submit */}
                            <motion.button
                                type="submit"
                                disabled={loading}
                                className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-linear-to-r from-blue-600 via-indigo-600 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                                whileHover={loading ? {} : { scale: 1.02 }}
                                whileTap={loading ? {} : { scale: 0.98 }}
                            >
                                <motion.div
                                    className="absolute inset-0 bg-linear-to-r from-blue-500 via-cyan-400 to-emerald-400"
                                    initial={{ x: "100%" }}
                                    whileHover={{ x: "0%" }}
                                    transition={{ duration: 0.3 }}
                                />
                                <span className="relative z-10 flex items-center gap-2">
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {isSignIn ? "Signing in…" : "Creating account…"}
                                        </>
                                    ) : (
                                        <>
                                            {isSignIn ? "Sign in" : "Create account"}
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </>
                                    )}
                                </span>
                            </motion.button>
                        </form>

                        {/* Terms */}
                        <p className="text-center text-xs text-gray-400 dark:text-white/30 leading-relaxed mt-6 pt-5 border-t border-gray-100 dark:border-white/5">
                            By continuing you agree to our{" "}
                            <a href="#" className="text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white underline underline-offset-2 transition-colors">Terms</a>
                            {" "}and{" "}
                            <a href="#" className="text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white underline underline-offset-2 transition-colors">Privacy Policy</a>.
                        </p>
                    </motion.div>

                    {/* Bottom switch */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-center text-sm text-gray-500 dark:text-white/40 mt-6"
                    >
                        {isSignIn ? "New to Canvas?" : "Already have an account?"}{" "}
                        <Link
                            href={isSignIn ? "/signup" : "/signin"}
                            className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold transition-colors"
                        >
                            {isSignIn ? "Create a free account" : "Sign in instead"}
                        </Link>
                    </motion.p>
                </motion.div>
            </main>
        </div>
    );
}