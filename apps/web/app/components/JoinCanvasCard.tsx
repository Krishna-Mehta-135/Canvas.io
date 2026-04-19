"use client";

import axios from "axios";
import {FormEvent, useState} from "react";
import {ArrowRight, Link2} from "lucide-react";
import {HTTP_BACKEND} from "../../config";

function normalizeCanvasTarget(rawValue: string) {
    const trimmed = rawValue.trim();
    if (!trimmed) return "";

    try {
        const url = new URL(trimmed, window.location.origin);
        const segments = url.pathname.split("/").filter(Boolean);
        const canvasIndex = segments.indexOf("canvas");

        if (canvasIndex >= 0 && segments[canvasIndex + 1]) {
            return segments[canvasIndex + 1];
        }

        return segments[segments.length - 1] ?? trimmed;
    } catch {
        return trimmed.replace(/^\/+|\/+$/g, "");
    }
}

export default function JoinCanvasCard() {
    const [value, setValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const target = normalizeCanvasTarget(value);
        if (!target) return;

        const destination = `/canvas/${target}`;

        setIsLoading(true);
        try {
            await axios.get(`${HTTP_BACKEND}/auth/current-user`, {
                withCredentials: true,
            });
            window.location.href = destination;
        } catch {
            const redirectTarget = encodeURIComponent(destination);
            window.location.href = `/signin?redirect=${redirectTarget}`;
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section id="join-canvas" className="relative mx-auto -mt-3 max-w-6xl px-5 sm:px-8 lg:px-10 pb-8 sm:pb-10 scroll-mt-24">
            <div className="relative overflow-hidden rounded-4xl border-2 border-gray-900/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
                <div className="absolute inset-0 bg-linear-to-r from-blue-50 via-cyan-50 to-amber-50 opacity-90" />
                <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:p-10">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                            <Link2 className="h-3.5 w-3.5" />
                            Join a canvas
                        </div>
                        <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                            Paste a link or enter a room code.
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600 sm:text-base">
                            Jump straight into an existing board by pasting the invite URL or a room slug.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
                        <input
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            placeholder="Paste invite link or room code"
                            className="h-12 min-w-0 flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            {isLoading ? "Checking..." : "Join canvas"}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            </div>
        </section>
    );
}