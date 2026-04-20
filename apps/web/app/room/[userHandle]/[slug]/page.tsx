"use client";

import {useEffect, useState} from "react";
import {useParams} from "next/navigation";
import {AxiosError} from "axios";
import {HTTP_BACKEND} from "../../../../config";
import {apiClient} from "../../../lib/apiClient";
import {ensureAuthenticated} from "../../../lib/auth";

type ResolvedRoom = {
    id: number;
    slug: string;
    canonicalPath: string;
};

export default function RoomBySlugPage() {
    const params = useParams<{userHandle: string; slug: string}>();
    const userHandle = Array.isArray(params?.userHandle) ? params.userHandle[0] : params?.userHandle;
    const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userHandle || !slug) return;

        let isUnmounted = false;

        const resolveAndRedirect = async () => {
            const currentPath = `/room/${encodeURIComponent(userHandle)}/${encodeURIComponent(slug)}`;
            const isAuthenticated = await ensureAuthenticated(currentPath);
            if (!isAuthenticated || isUnmounted) return;

            try {
                const response = await apiClient.get(
                    `${HTTP_BACKEND}/room/resolve/${encodeURIComponent(userHandle)}/${encodeURIComponent(slug)}`
                );

                const room = response.data?.data as ResolvedRoom;
                const roomSlug = room?.slug;

                if (typeof roomSlug !== "string" || roomSlug.length === 0) {
                    throw new Error("Invalid room payload");
                }

                window.location.replace(
                    `/canvas/${encodeURIComponent(roomSlug)}?owner=${encodeURIComponent(userHandle)}`
                );
            } catch (errorResponse) {
                const axiosError = errorResponse as AxiosError<{message?: string}>;
                if (axiosError.response?.status === 404) {
                    setError("Room not found.");
                    return;
                }

                setError("Unable to open this room right now.");
            }
        };

        void resolveAndRedirect();

        return () => {
            isUnmounted = true;
        };
    }, [userHandle, slug]);

    return (
        <main className="grid min-h-screen place-items-center bg-[#f2f5fa] px-5">
            <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 text-center shadow-sm">
                <h1 className="text-lg font-semibold text-slate-900">Opening room...</h1>
                <p className="mt-2 text-sm text-slate-600">
                    {error ?? "Resolving room and loading canvas."}
                </p>
            </div>
        </main>
    );
}