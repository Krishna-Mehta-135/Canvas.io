"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AxiosError } from "axios";
import { HTTP_BACKEND } from "../../../../config";
import { apiClient } from "../../../lib/apiClient";
import { ensureAuthenticated } from "../../../lib/auth";

type ResolvedRoom = {
  id: number;
  slug: string;
  canonicalPath: string;
};

export default function RoomBySlugPage() {
  const params = useParams<{ userHandle: string; slug: string }>();
  const userHandle = Array.isArray(params?.userHandle)
    ? params.userHandle[0]
    : params?.userHandle;
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const [error, setError] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const [statusHint, setStatusHint] = useState<string | null>(null);

  useEffect(() => {
    if (!userHandle || !slug) return;

    let isUnmounted = false;

    const resolveAndRedirect = async () => {
      const currentPath = `/room/${encodeURIComponent(userHandle)}/${encodeURIComponent(slug)}`;
      const isAuthenticated = await ensureAuthenticated(currentPath);
      if (!isAuthenticated || isUnmounted) return;

      try {
        const response = await apiClient.get(
          `${HTTP_BACKEND}/room/resolve/${encodeURIComponent(userHandle)}/${encodeURIComponent(slug)}`,
        );

        const room = response.data?.data as ResolvedRoom;
        const roomSlug = room?.slug;

        if (typeof roomSlug !== "string" || roomSlug.length === 0) {
          throw new Error("Invalid room payload");
        }

        const destination = `/canvas/${encodeURIComponent(roomSlug)}?owner=${encodeURIComponent(userHandle)}`;
        const currentLocation = `${window.location.pathname}${window.location.search}`;

        // This route is a resolver shell only; always move to the canvas route.
        // Guard against no-op replace calls that can trigger apparent refresh loops.
        if (currentLocation === destination) {
          return;
        }

        window.location.replace(destination);
      } catch (errorResponse) {
        const axiosError = errorResponse as AxiosError<{ message?: string }>;
        if (axiosError.response?.status === 403) {
          setRequestState("sending");
          setStatusHint("Requesting access from room owner...");
          try {
            await apiClient.post(`${HTTP_BACKEND}/room/access/request`, {
              ownerHandle: userHandle,
              slug,
            });
            setRequestState("sent");
            setStatusHint(
              "Waiting for owner approval. This page will auto-open when approved.",
            );
            setError(
              "Access request sent to room owner. You can open the room once approved.",
            );
          } catch {
            setRequestState("idle");
            setStatusHint(null);
            setError("Access denied. Unable to send request right now.");
          }
          return;
        }

        if (axiosError.response?.status === 404) {
          setError("Room unavailable.");
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

  useEffect(() => {
    if (!userHandle || !slug || requestState !== "sent") return;

    let isUnmounted = false;

    const pollForApproval = async () => {
      try {
        const response = await apiClient.get(
          `${HTTP_BACKEND}/room/resolve/${encodeURIComponent(userHandle)}/${encodeURIComponent(slug)}`,
        );

        if (isUnmounted) return;

        const room = response.data?.data as ResolvedRoom;
        const roomSlug = room?.slug;
        if (typeof roomSlug !== "string" || roomSlug.length === 0) {
          return;
        }

        const destination = `/canvas/${encodeURIComponent(roomSlug)}?owner=${encodeURIComponent(userHandle)}`;
        window.location.replace(destination);
      } catch (errorResponse) {
        const axiosError = errorResponse as AxiosError;
        if (axiosError.response?.status === 403) {
          return;
        }
      }
    };

    void pollForApproval();
    const timer = window.setInterval(() => {
      void pollForApproval();
    }, 3000);

    return () => {
      isUnmounted = true;
      window.clearInterval(timer);
    };
  }, [requestState, userHandle, slug]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f2f5fa] px-5">
      <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          {error ? "Unable to open room" : "Opening room..."}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {error ?? "Resolving room and loading canvas."}
        </p>
        {requestState === "sending" && (
          <p className="mt-2 text-xs text-slate-500">
            Sending access request...
          </p>
        )}
        {requestState === "sent" && (
          <p className="mt-2 text-xs text-slate-500">
            {statusHint ?? "Waiting for approval..."}
          </p>
        )}
      </div>
    </main>
  );
}
