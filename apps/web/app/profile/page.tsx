"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {HTTP_BACKEND} from "../../config";
import {apiClient} from "../lib/apiClient";
import {ensureAuthenticated} from "../lib/auth";
import {useTheme} from "../components/ThemeToggle";

type ProfileData = {
    id: string;
    name: string;
    email: string;
};

export default function ProfilePage() {
    const router = useRouter();
    const {theme} = useTheme();
    const isDark = theme === "dark";
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let isUnmounted = false;

        const loadProfile = async () => {
            const authenticated = await ensureAuthenticated("/profile");
            if (!authenticated || isUnmounted) {
                return;
            }

            try {
                const response = await apiClient.get(`${HTTP_BACKEND}/auth/current-user`);
                const user = response.data?.data;

                if (isUnmounted) return;

                if (user && typeof user.id === "string" && typeof user.name === "string" && typeof user.email === "string") {
                    setProfile({
                        id: user.id,
                        name: user.name,
                        email: user.email,
                    });
                } else {
                    setErrorMessage("Unable to load your profile details.");
                }
            } catch {
                if (!isUnmounted) {
                    setErrorMessage("Unable to load your profile details.");
                }
            } finally {
                if (!isUnmounted) {
                    setIsLoading(false);
                }
            }
        };

        void loadProfile();

        return () => {
            isUnmounted = true;
        };
    }, []);

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
                <h1 className="text-xl font-semibold">Profile</h1>
                <p className="mt-1 text-sm opacity-75">Your account details</p>

                {isLoading && <p className="mt-5 text-sm">Loading profile...</p>}

                {!isLoading && errorMessage && (
                    <p className={`mt-5 text-sm ${isDark ? "text-red-300" : "text-red-700"}`}>{errorMessage}</p>
                )}

                {!isLoading && profile && (
                    <div className="mt-5 space-y-3 text-sm">
                        <div className="rounded-xl border border-current/10 px-3 py-2">
                            <div className="opacity-70">Name</div>
                            <div className="font-medium">{profile.name}</div>
                        </div>
                        <div className="rounded-xl border border-current/10 px-3 py-2">
                            <div className="opacity-70">Email</div>
                            <div className="font-medium">{profile.email}</div>
                        </div>
                        <div className="rounded-xl border border-current/10 px-3 py-2">
                            <div className="opacity-70">User ID</div>
                            <div className="font-medium break-all">{profile.id}</div>
                        </div>
                        <div className="rounded-xl border border-current/10 px-3 py-2">
                            <div className="opacity-70">Security</div>
                            <div className="mt-2">
                                <button
                                    type="button"
                                    onClick={() => router.push("/forgot-password")}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                        isDark ? "border-white/15 hover:bg-white/10" : "border-slate-300 hover:bg-slate-100"
                                    }`}
                                >
                                    Forgot password?
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                            isDark ? "border-white/15 hover:bg-white/10" : "border-slate-300 hover:bg-slate-100"
                        }`}
                    >
                        Go back
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push("/")}
                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                            isDark ? "border-white/15 hover:bg-white/10" : "border-slate-300 hover:bg-slate-100"
                        }`}
                    >
                        Home
                    </button>
                </div>
            </section>
        </main>
    );
}
