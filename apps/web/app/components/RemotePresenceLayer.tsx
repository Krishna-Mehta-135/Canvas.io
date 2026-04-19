"use client";

import {useEffect, useMemo, useState} from "react";
import {convertToPoints, type Shape} from "@repo/canvas-engine";
import type {RoomPresenceState} from "@repo/common";

type ViewportLike = {
    x: number;
    y: number;
    scale: number;
};

type RemotePresenceLayerProps = {
    presenceState: RoomPresenceState;
    currentUserId: string | null;
    viewport: ViewportLike | null;
    shapes: Shape[];
    isDark: boolean;
};

type PresenceRender = {
    userId: string;
    userName: string;
    selectedIds: string[];
    color: string;
    tool: string | null;
};

const PRESENCE_COLORS = ["#f97316", "#22c55e", "#38bdf8", "#fb7185", "#eab308", "#c084fc"];
const ACTIVE_WINDOW_MS = 1400;

function hashString(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getSelectionBounds(shapes: Shape[], selectedIds: string[]) {
    const selectedShapes = shapes.filter((shape) => selectedIds.includes(shape.id));
    if (selectedShapes.length === 0) return null;

    const first = convertToPoints(selectedShapes[0]!);
    let minX = first.x1;
    let minY = first.y1;
    let maxX = first.x2;
    let maxY = first.y2;

    for (let index = 1; index < selectedShapes.length; index += 1) {
        const box = convertToPoints(selectedShapes[index]!);
        minX = Math.min(minX, box.x1);
        minY = Math.min(minY, box.y1);
        maxX = Math.max(maxX, box.x2);
        maxY = Math.max(maxY, box.y2);
    }

    return {x1: minX, y1: minY, x2: maxX, y2: maxY};
}

function isPresenceActing(presence: PresenceRender) {
    return presence.selectedIds.length > 0 || (presence.tool !== null && presence.tool !== "select");
}

/**
 * Renders remote collaborators' selection outlines and activity labels above the canvas.
 */
export function RemotePresenceLayer({presenceState, currentUserId, viewport, shapes, isDark}: RemotePresenceLayerProps) {
    const presences = Array.isArray(presenceState?.presences) ? presenceState.presences : [];
    const safeShapes = Array.isArray(shapes) ? shapes : [];
    const [now, setNow] = useState(() => Date.now());
    const [lastActiveByUser, setLastActiveByUser] = useState<Record<string, number>>({});

    const remotePresences: PresenceRender[] = useMemo(
        () =>
            presences
                .filter((presence) => presence.userId !== currentUserId)
                .map((presence) => {
                    const color = PRESENCE_COLORS[hashString(presence.userId) % PRESENCE_COLORS.length] ?? PRESENCE_COLORS[0]!;
                    return {
                        ...presence,
                        color,
                    };
                }),
        [currentUserId, presences]
    );

    useEffect(() => {
        const timestamp = Date.now();

        setLastActiveByUser((previous) => {
            const next = {...previous};
            for (const presence of remotePresences) {
                if (isPresenceActing(presence)) {
                    next[presence.userId] = timestamp;
                }
            }
            return next;
        });
    }, [remotePresences, presenceState]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNow(Date.now());
        }, 250);

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    const activePresences = useMemo(() => {
        return remotePresences.filter((presence) => {
            const lastActiveAt = lastActiveByUser[presence.userId] ?? 0;
            return now - lastActiveAt <= ACTIVE_WINDOW_MS;
        });
    }, [lastActiveByUser, now, remotePresences]);

    const canRenderOverlay = Boolean(viewport) && (presenceState?.connectedUsersCount ?? 0) > 1;

    if (!canRenderOverlay || activePresences.length === 0 || !viewport) {
        return null;
    }

    const floatingOnly = activePresences.filter(
        (presence) => getSelectionBounds(safeShapes, presence.selectedIds) === null
    );

    return (
        <div className="pointer-events-none absolute inset-0 z-30">
            {activePresences.map((presence) => {
                const selectionBounds = getSelectionBounds(safeShapes, presence.selectedIds);

                return (
                    <div key={presence.userId} className="absolute inset-0">
                        {selectionBounds && (
                            <div
                                className={`absolute rounded-md border-2 ${isDark ? "bg-transparent" : "bg-white/5"}`}
                                style={{
                                    left: `${selectionBounds.x1 * viewport.scale + viewport.x}px`,
                                    top: `${selectionBounds.y1 * viewport.scale + viewport.y}px`,
                                    width: `${(selectionBounds.x2 - selectionBounds.x1) * viewport.scale}px`,
                                    height: `${(selectionBounds.y2 - selectionBounds.y1) * viewport.scale}px`,
                                    borderColor: presence.color,
                                    boxShadow: `0 0 0 1px ${presence.color}22, 0 0 18px ${presence.color}33`,
                                }}
                            >
                                <div
                                    className="absolute -top-3 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg"
                                    style={{backgroundColor: presence.color}}
                                >
                                    {presence.userName}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {floatingOnly.length > 0 && (
                <div className="absolute right-4 top-16 flex flex-col gap-2">
                    {floatingOnly.map((presence) => (
                        <div
                            key={`floating-${presence.userId}`}
                            className="rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-lg"
                            style={{backgroundColor: presence.color}}
                        >
                            {presence.userName}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}