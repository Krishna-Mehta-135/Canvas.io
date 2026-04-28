"use client";

import { FormEvent, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "../components/ThemeToggle";
import { HTTP_BACKEND } from "../../config";
import { apiClient } from "../lib/apiClient";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Reset token is missing.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`${HTTP_BACKEND}/auth/reset-password`, {
        token,
        password,
      });
      setSuccess(true);
    } catch (submitError: unknown) {
      const message =
        (submitError as { response?: { data?: { message?: string } } })
          ?.response?.data?.message || "Unable to reset password.";
      setError(message);
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
        <h1 className="text-xl font-semibold">Reset Password</h1>
        <p className="mt-1 text-sm opacity-75">
          Set a new password for your account.
        </p>

        {!success && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div>
              <label
                className="mb-1 block text-xs font-semibold opacity-75"
                htmlFor="reset-password"
              >
                New password
              </label>
              <input
                id="reset-password"
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                  isDark
                    ? "border-white/15 bg-[#101010] text-white placeholder:text-white/40 focus:border-white/30"
                    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-500"
                }`}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold opacity-75"
                htmlFor="reset-confirm-password"
              >
                Confirm password
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                  isDark
                    ? "border-white/15 bg-[#101010] text-white placeholder:text-white/40 focus:border-white/30"
                    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-500"
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                isDark
                  ? "border-white/15 hover:bg-white/10"
                  : "border-slate-300 hover:bg-slate-100"
              } ${isSubmitting ? "cursor-not-allowed opacity-70" : ""}`}
            >
              {isSubmitting ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}

        {error && (
          <p
            className={`mt-3 text-xs ${isDark ? "text-red-300" : "text-red-700"}`}
          >
            {error}
          </p>
        )}

        {success && (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-xs ${isDark ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}
          >
            Password reset successful. You can now sign in with your new
            password.
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#eef2f7] dark:bg-[#121212]" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
