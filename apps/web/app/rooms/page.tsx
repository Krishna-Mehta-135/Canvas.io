"use client";

import {FormEvent, useEffect, useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import {AxiosError} from "axios";
import {HTTP_BACKEND} from "../../config";
import {apiClient} from "../lib/apiClient";
import {ensureAuthenticated, logoutUser} from "../lib/auth";
import {useTheme} from "../components/ThemeToggle";

type CurrentUser = {
    id: string;
    name: string;
    handle: string | null;
    email: string;
};

type Room = {
    id: number;
    slug: string;
    createdAt: string;
    canonicalPath: string;
};

type RawRoom = Partial<Room> & {
    id?: number;
    slug?: string;
    createdAt?: string;
    canonicalPath?: string;
};

function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32);
}

function formatDate(isoDate: string): string {
    try {
        return new Date(isoDate).toLocaleString();
    } catch {
        return isoDate;
    }
}

function normalizeRoom(room: RawRoom, handle: string | null): Room | null {
    if (typeof room.id !== "number" || typeof room.slug !== "string") {
        return null;
    }

    const fallbackCanonicalPath = handle && handle.length > 0
        ? `/room/${encodeURIComponent(handle)}/${encodeURIComponent(room.slug)}`
        : `/canvas/${encodeURIComponent(room.slug)}`;

    return {
        id: room.id,
        slug: room.slug,
        createdAt: typeof room.createdAt === "string" ? room.createdAt : new Date().toISOString(),
        canonicalPath: typeof room.canonicalPath === "string" && room.canonicalPath.length > 0
            ? room.canonicalPath
            : fallbackCanonicalPath,
    };
}

export default function RoomsPage() {
    const router = useRouter();
    const {theme} = useTheme();
    const isDark = theme === "dark";

    const [user, setUser] = useState<CurrentUser | null>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [newRoomSlug, setNewRoomSlug] = useState("");
    const [creatingRoom, setCreatingRoom] = useState(false);

    const [renamingRoomId, setRenamingRoomId] = useState<number | null>(null);
    const [renameDraft, setRenameDraft] = useState("");
    const [savingRename, setSavingRename] = useState(false);

    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const sortedRooms = useMemo(() => {
        return [...rooms].sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [rooms]);

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            const isAuthenticated = await ensureAuthenticated("/rooms");
            if (!isAuthenticated) return;

            const userResponse = await apiClient.get(`${HTTP_BACKEND}/auth/current-user`);
            const currentUser = userResponse.data?.data as CurrentUser;
            setUser(currentUser);

            try {
                const roomsResponse = await apiClient.get(`${HTTP_BACKEND}/room/mine`);
                const roomList = (roomsResponse.data?.data ?? []) as RawRoom[];

                const normalizedRooms = Array.isArray(roomList)
                    ? roomList
                        .map((room) => normalizeRoom(room, currentUser.handle))
                        .filter((room): room is Room => room !== null)
                    : [];

                setRooms(normalizedRooms);
            } catch {
                setRooms([]);
                setError("Unable to load your rooms right now.");
            }
        } catch {
            setError("Unable to load your account right now.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const handleCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const slug = slugify(newRoomSlug);

        if (slug.length < 3) {
            setError("Room slug must be at least 3 characters.");
            return;
        }

        setCreatingRoom(true);
        setError(null);

        try {
            const response = await apiClient.post(`${HTTP_BACKEND}/room`, {slug});
            const rawRoom = response.data?.data as RawRoom;
            const room = normalizeRoom(rawRoom, user?.handle ?? null);

            if (!room) {
                throw new Error("Invalid room payload");
            }

            setRooms((current) => [room, ...current.filter((entry) => entry.id !== room.id)]);
            setNewRoomSlug("");
            window.location.href = room.canonicalPath;
        } catch (errorResponse) {
            const axiosError = errorResponse as AxiosError<{message?: string}>;
            setError(axiosError.response?.data?.message ?? "Unable to create room.");
        } finally {
            setCreatingRoom(false);
        }
    };

    const handleStartRename = (room: Room) => {
        setRenamingRoomId(room.id);
        setRenameDraft(room.slug);
    };

    const handleCancelRename = () => {
        setRenamingRoomId(null);
        setRenameDraft("");
    };

    const handleSaveRename = async (roomId: number) => {
        const slug = slugify(renameDraft);
        if (slug.length < 3) {
            setError("Room slug must be at least 3 characters.");
            return;
        }

        setSavingRename(true);
        setError(null);

        try {
            const response = await apiClient.patch(`${HTTP_BACKEND}/room/${roomId}/slug`, {slug});
            const updatedRoom = response.data?.data as Room;

            setRooms((current) =>
                current.map((room) => {
                    if (room.id !== roomId) return room;
                    return {
                        ...room,
                        slug: updatedRoom.slug,
                        canonicalPath: updatedRoom.canonicalPath,
                    };
                })
            );

            setRenamingRoomId(null);
            setRenameDraft("");
        } catch (errorResponse) {
            const axiosError = errorResponse as AxiosError<{message?: string}>;
            setError(axiosError.response?.data?.message ?? "Unable to rename room.");
        } finally {
            setSavingRename(false);
        }
    };

    const handleLogout = async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);
        try {
            await logoutUser();
        } finally {
            window.location.href = "/signin";
        }
    };

    return (
        <main className={`min-h-screen px-5 py-8 sm:px-8 sm:py-10 ${isDark ? "bg-[#121212] text-white" : "bg-[#f2f5fa] text-slate-900"}`}>
            <section className="mx-auto w-full max-w-5xl">
                <div className={`rounded-3xl border p-6 sm:p-8 ${isDark ? "border-white/10 bg-[#191919]/95" : "border-slate-300/90 bg-slate-50/95"}`}>
                    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Your Canvases</h1>
                            <p className="mt-1 text-sm opacity-80">Create, rename, and switch between rooms.</p>
                            {user && (
                                <p className="mt-2 text-xs opacity-70">
                                    Signed in as {user.name} ({user.handle ?? "no-handle"})
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => router.push("/profile")}
                                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${isDark ? "border-white/20 hover:bg-white/10" : "border-slate-300 bg-white/70 hover:bg-white"}`}
                            >
                                Profile
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleLogout()}
                                disabled={isLoggingOut}
                                className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${isDark ? "border-red-300/30 bg-red-500/10 text-red-100 hover:bg-red-500/20" : "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"}`}
                            >
                                {isLoggingOut ? "Signing out..." : "Sign out"}
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleCreateRoom} className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                            value={newRoomSlug}
                            onChange={(event) => setNewRoomSlug(event.target.value)}
                            placeholder="new-canvas-slug"
                            className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDark ? "border-white/15 bg-[#171717] text-white placeholder:text-white/40 focus:border-cyan-300/40" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-400"}`}
                        />
                        <button
                            type="submit"
                            disabled={creatingRoom}
                            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${isDark ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20" : "border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"}`}
                        >
                            {creatingRoom ? "Creating..." : "Create canvas"}
                        </button>
                    </form>

                    {error && <p className={`mb-4 text-sm ${isDark ? "text-red-300" : "text-red-700"}`}>{error}</p>}

                    {loading ? (
                        <p className="text-sm opacity-70">Loading rooms...</p>
                    ) : sortedRooms.length === 0 ? (
                        <p className="text-sm opacity-70">No canvases yet. Create one to get started.</p>
                    ) : (
                        <div className="space-y-3">
                            {sortedRooms.map((room) => {
                                const isEditing = renamingRoomId === room.id;

                                return (
                                    <div key={room.id} className={`rounded-xl border p-3 ${isDark ? "border-white/10 bg-black/15" : "border-slate-200 bg-white"}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold">/{room.slug}</p>
                                                <p className="text-xs opacity-70">Created: {formatDate(room.createdAt)}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <a
                                                    href={room.canonicalPath}
                                                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${isDark ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20" : "border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"}`}
                                                >
                                                    Open
                                                </a>
                                                {!isEditing ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartRename(room)}
                                                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${isDark ? "border-white/15 hover:bg-white/10" : "border-slate-300 hover:bg-slate-100"}`}
                                                    >
                                                        Rename
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleSaveRename(room.id)}
                                                            disabled={savingRename}
                                                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${isDark ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20" : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}
                                                        >
                                                            {savingRename ? "Saving..." : "Save"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleCancelRename}
                                                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${isDark ? "border-white/15 hover:bg-white/10" : "border-slate-300 hover:bg-slate-100"}`}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {isEditing && (
                                            <div className="mt-3">
                                                <input
                                                    value={renameDraft}
                                                    onChange={(event) => setRenameDraft(event.target.value)}
                                                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${isDark ? "border-white/15 bg-[#171717] text-white placeholder:text-white/40 focus:border-cyan-300/40" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-400"}`}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}