"use client";

import {useEffect, useMemo, useRef, useState} from "react";
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
const ACTIVE_WINDOW_MS = 2200;
const ACTIVITY_MOVE_EPSILON = 0.75;

type SelectionBounds = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

function hashString(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getSelectionBounds(shapeById: Map<string, Shape>, selectedIds: string[]) {
    const firstSelected = selectedIds
        .map((id) => shapeById.get(id))
        .find((shape): shape is Shape => Boolean(shape));

    if (!firstSelected) {
        return null;
    }

    const first = convertToPoints(firstSelected);
    let minX = first.x1;
    let minY = first.y1;
    let maxX = first.x2;
    let maxY = first.y2;

    for (const selectedId of selectedIds) {
        const selectedShape = shapeById.get(selectedId);
        if (!selectedShape || selectedShape.id === firstSelected.id) {
            continue;
        }

        const box = convertToPoints(selectedShape);
        minX = Math.min(minX, box.x1);
        minY = Math.min(minY, box.y1);
        maxX = Math.max(maxX, box.x2);
        maxY = Math.max(maxY, box.y2);
    }

    return {x1: minX, y1: minY, x2: maxX, y2: maxY};
}

function areBoundsMoving(previous: SelectionBounds | null, next: SelectionBounds | null) {
    if (!previous || !next) {
        return false;
    }

    return (
        Math.abs(previous.x1 - next.x1) > ACTIVITY_MOVE_EPSILON ||
        Math.abs(previous.y1 - next.y1) > ACTIVITY_MOVE_EPSILON ||
        Math.abs(previous.x2 - next.x2) > ACTIVITY_MOVE_EPSILON ||
        Math.abs(previous.y2 - next.y2) > ACTIVITY_MOVE_EPSILON
    );
}


function isPresenceActing(presence: PresenceRender) {
    return presence.selectedIds.length > 0 || (presence.tool !== null && presence.tool !== "select");
}

/**
 * Renders remote collaborators' selection outlines and activity labels above the canvas.
 */
export function RemotePresenceLayer({presenceState, currentUserId, viewport, shapes, isDark}: RemotePresenceLayerProps) {
    const presences = useMemo(() => (Array.isArray(presenceState?.presences) ? presenceState.presences : []), [
        presenceState,
    ]);
    const safeShapes = useMemo(() => (Array.isArray(shapes) ? shapes : []), [shapes]);
    const [now, setNow] = useState(() => Date.now());
    const [lastActiveByUser, setLastActiveByUser] = useState<Record<string, number>>({});
    const previousBoundsByUserRef = useRef<Record<string, SelectionBounds | null>>({});

    const shapeById = useMemo(() => {
        const index = new Map<string, Shape>();
        for (const shape of safeShapes) {
            index.set(shape.id, shape);
        }
        return index;
    }, [safeShapes]);

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

    const selectionBoundsByUser = useMemo(() => {
        const byUser: Record<string, SelectionBounds | null> = {};
        for (const presence of remotePresences) {
            byUser[presence.userId] = getSelectionBounds(shapeById, presence.selectedIds);
        }
        return byUser;
    }, [remotePresences, shapeById]);

    useEffect(() => {
        const timestamp = Date.now();

        setLastActiveByUser((previous) => {
            const next = {...previous};
            for (const presence of remotePresences) {
                const nextBounds = selectionBoundsByUser[presence.userId] ?? null;
                const previousBounds = previousBoundsByUserRef.current[presence.userId] ?? null;
                if (isPresenceActing(presence) || areBoundsMoving(previousBounds, nextBounds)) {
                    next[presence.userId] = timestamp;
                }
            }
            return next;
        });

        previousBoundsByUserRef.current = selectionBoundsByUser;
    }, [remotePresences, selectionBoundsByUser]);

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

    const floatingOnly = activePresences.filter((presence) => {
        const hasSelection = presence.selectedIds.length > 0;
        const hasSelectionBounds = (selectionBoundsByUser[presence.userId] ?? null) !== null;

        // When a user has selected shapes, avoid detaching their name into the
        // floating stack; detached labels look like they move independently.
        return !hasSelection && !hasSelectionBounds;
    });

    return (
        <div className="pointer-events-none absolute inset-0 z-30">
            {activePresences.map((presence) => {
                const selectionBounds = selectionBoundsByUser[presence.userId] ?? null;

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