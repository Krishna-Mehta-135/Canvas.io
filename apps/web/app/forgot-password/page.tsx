"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../components/ThemeToggle";
import { HTTP_BACKEND } from "../../config";
import { apiClient } from "../lib/apiClient";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSubmitErrorMessage = (submitError: unknown) => {
    if (
      typeof submitError === "object" &&
      submitError !== null &&
      "response" in submitError
    ) {
      const response = submitError.response as
        | { data?: { message?: string } }
        | undefined;
      return response?.data?.message || "Unable to request reset link.";
    }

    return "Unable to request reset link.";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`${HTTP_BACKEND}/auth/forgot-password`, {
        email,
      });
      setSubmitted(true);
    } catch (submitError: unknown) {
      setError(getSubmitErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className={`grid min-h-screen place-items-center px-6 py-10 ${
        isDark ? "bg-[#121212] text-white" : "bg-[#eef2f7] text-slate-900"
      }`}
    >
      <section
        className={`w-full max-w-lg rounded-3xl border p-6 ${
          isDark
            ? "border-white/10 bg-[#191919]/95 shadow-[0_18px_30px_rgba(0,0,0,0.45)]"
            : "border-slate-300/80 bg-white/95 shadow-[0_18px_28px_rgba(15,23,42,0.12)]"
        }`}
      >
        <h1 className="text-xl font-semibold">Forgot Password</h1>
        <p className="mt-1 text-sm opacity-75">
          Request password reset instructions
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label
            className="block text-xs font-semibold opacity-75"
            htmlFor="forgot-email"
          >
            Email address
          </label>
          <input
            id="forgot-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
              isDark
                ? "border-white/15 bg-[#101010] text-white placeholder:text-white/40 focus:border-white/30"
                : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-500"
            }`}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              isDark
                ? "border-white/15 hover:bg-white/10"
                : "border-slate-300 hover:bg-slate-100"
            } ${isSubmitting ? "cursor-not-allowed opacity-70" : ""}`}
          >
            {isSubmitting ? "Requesting..." : "Request reset link"}
          </button>
        </form>

        {error && (
          <p
            className={`mt-3 text-xs ${isDark ? "text-red-300" : "text-red-700"}`}
          >
            {error}
          </p>
        )}

        {submitted && (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
              isDark
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-700"
            }`}
          >
            If an account exists for this email, reset instructions will be
            sent. Check your inbox and spam folder.
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/signin")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              isDark
                ? "border-white/15 hover:bg-white/10"
                : "border-slate-300 hover:bg-slate-100"
            }`}
          >
            Back to sign in
          </button>
        </div>
      </section>
    </main>
  );
}
