"use client";

import { useState, FormEvent, useEffect } from "react";
import { AxiosError } from "axios";
import { ArrowRight, Eye, EyeOff, Pencil, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {HTTP_BACKEND} from "../../config";
import {apiClient} from "../lib/apiClient";

const API_BASE = HTTP_BACKEND;

interface AuthPageProps {
    isSignIn: boolean;
}

export function AuthPage({ isSignIn }: AuthPageProps) {
    const searchParams = useSearchParams();
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

                if (isUnmounted) {
                    return;
                }

                const redirectTarget = searchParams.get("redirect");
                window.location.href = redirectTarget && redirectTarget.length > 0 ? redirectTarget : "/rooms";
            } catch {
                if (!isUnmounted) {
                    setCheckingSession(false);
                }
            }
        };

        void checkExistingSession();

        return () => {
            isUnmounted = true;
        };
    }, [searchParams]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const endpoint = isSignIn
                ? `${API_BASE}/auth/signin`
                : `${API_BASE}/auth/signup`;

            const payload = isSignIn
                ? { email, password }
                : { name, email, password };

            await apiClient.post(endpoint, payload);

            const redirectTarget = searchParams.get("redirect");
            if (redirectTarget) {
                window.location.href = redirectTarget;
                return;
            }

            window.location.href = "/rooms";
        } catch (err) {
            const axiosError = err as AxiosError<{ message: string }>;
            const message =
                axiosError.response?.data?.message ||
                (isSignIn
                    ? "Invalid email or password."
                    : "Something went wrong. Please try again.");
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="min-h-screen bg-linear-to-b from-amber-50 via-white to-white flex items-center justify-center">
                <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm font-medium text-gray-700 shadow-sm">
                    Checking session...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-amber-50 via-white to-white flex flex-col">
            {/* Decorative background blobs */}
            <div className="fixed -top-20 -left-12 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl pointer-events-none" />
            <div className="fixed top-16 right-0 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl pointer-events-none" />
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 h-64 w-96 rounded-full bg-blue-300/15 blur-3xl pointer-events-none" />

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between max-w-6xl mx-auto w-full px-5 sm:px-8 lg:px-10 py-5">
                <a href="/" className="flex items-center gap-2.5 group">
                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-blue-700 transition-colors">
                        <Pencil className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-bold text-gray-900 tracking-tight">Canvas</span>
                </a>
                <a
                    href={isSignIn ? "/signup" : "/signin"}
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
                >
                    {isSignIn ? (
                        <>
                            No account?{" "}
                            <span className="text-blue-600 hover:text-blue-700 font-semibold">Sign up</span>
                        </>
                    ) : (
                        <>
                            Already have an account?{" "}
                            <span className="text-blue-600 hover:text-blue-700 font-semibold">Sign in</span>
                        </>
                    )}
                </a>
            </header>

            {/* Main content */}
            <main className="relative z-10 flex flex-1 items-center justify-center px-5 sm:px-8 py-12">
                <div className="w-full max-w-md">
                    {/* Card */}
                    <div className="bg-white rounded-3xl border-2 border-gray-200 shadow-xl shadow-gray-100/80 p-8 sm:p-10">
                        {/* Title */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                                {isSignIn ? "Welcome back" : "Create your account"}
                            </h1>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                {isSignIn
                                    ? "Sign in to continue sketching your ideas."
                                    : "Join thousands of teams sketching together."}
                            </p>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Name field — only for signup */}
                            {!isSignIn && (
                                <div>
                                    <label
                                        htmlFor="name"
                                        className="block text-sm font-semibold text-gray-700 mb-1.5"
                                    >
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
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm font-medium transition-all outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-gray-300"
                                    />
                                </div>
                            )}

                            {/* Email field */}
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-semibold text-gray-700 mb-1.5"
                                >
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
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm font-medium transition-all outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-gray-300"
                                />
                            </div>

                            {/* Password field */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label
                                        htmlFor="password"
                                        className="block text-sm font-semibold text-gray-700"
                                    >
                                        Password
                                    </label>
                                    {isSignIn && (
                                        <a
                                            href="/forgot-password"
                                            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                        >
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
                                        className="w-full px-4 py-3 pr-11 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm font-medium transition-all outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-gray-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                                {!isSignIn && (
                                    <p className="mt-1.5 text-xs text-gray-400">
                                        Must be at least 8 characters.
                                    </p>
                                )}
                            </div>

                            {/* Submit button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="group w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mt-2"
                            >
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
                            </button>
                        </form>

                        {/* Divider + social sign-in placeholder */}
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <p className="text-center text-xs text-gray-400 leading-relaxed">
                                By continuing you agree to our{" "}
                                <a href="#" className="text-gray-600 hover:text-gray-900 underline underline-offset-2">
                                    Terms of Service
                                </a>{" "}
                                and{" "}
                                <a href="#" className="text-gray-600 hover:text-gray-900 underline underline-offset-2">
                                    Privacy Policy
                                </a>.
                            </p>
                        </div>
                    </div>

                    {/* Bottom switch link */}
                    <p className="text-center text-sm text-gray-500 mt-6">
                        {isSignIn ? "New to Canvas?" : "Already have an account?"}{" "}
                        <a
                            href={isSignIn ? "/signup" : "/signin"}
                            className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                        >
                            {isSignIn ? "Create a free account" : "Sign in instead"}
                        </a>
                    </p>
                </div>
            </main>
        </div>
    );
}