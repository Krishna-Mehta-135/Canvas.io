"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {
    ClientMessage,
    ChatParticipant,
    PersistedChatMessage,
    RoomChatBootstrap,
    RoomPresenceState,
} from "@repo/common";
import {RoomChatBootstrapSchema} from "@repo/common";
import {HTTP_BACKEND} from "../config";
import {apiClient} from "../app/lib/apiClient";

type SendWsMessage = (message: ClientMessage) => boolean;
type DeliveryState = "sending" | "failed";

export type CanvasChatMessage = PersistedChatMessage & {
    deliveryState?: DeliveryState;
    failureReason?: string | null;
    optimistic?: boolean;
};

export type UseCanvasChatResult = {
    isLoading: boolean;
    error: string | null;
    participants: ChatParticipant[];
    dmParticipants: Array<ChatParticipant & {isOnline: boolean}>;
    groupMessages: CanvasChatMessage[];
    directMessages: CanvasChatMessage[];
    comments: CanvasChatMessage[];
    commentsByShapeId: Map<string, CanvasChatMessage[]>;
    getDirectMessagesForUser: (partnerUserId: string) => CanvasChatMessage[];
    sendGroupMessage: (body: string) => boolean;
    sendDirectMessage: (recipientUserId: string, body: string) => boolean;
    sendComment: (shapeId: string, body: string) => boolean;
};

type UseCanvasChatOptions = {
    roomId: number | null;
    enabled?: boolean;
    currentUserId: string | null;
    presenceState: RoomPresenceState;
    realtimeChatMessages: PersistedChatMessage[];
    sendWsMessage: SendWsMessage;
    lastSyncError?: string | null;
};

function mergeById<T extends PersistedChatMessage>(existing: T[], incoming: T[]) {
    const merged = new Map<number, T>();

    for (const message of existing) {
        merged.set(message.id, message);
    }

    for (const message of incoming) {
        merged.set(message.id, message);
    }

    return [...merged.values()].sort((a, b) => {
        if (a.createdAt === b.createdAt) {
            return a.id - b.id;
        }

        return a.createdAt.localeCompare(b.createdAt);
    });
}

function isChatRelatedError(message: string | null | undefined) {
    if (!message) return false;

    const lower = message.toLowerCase();
    return (
        lower.includes("chat") ||
        lower.includes("comment") ||
        lower.includes("recipient") ||
        lower.includes("shape not found")
    );
}

function isMessageResolved(optimisticMessage: CanvasChatMessage, persistedMessages: PersistedChatMessage[]) {
    const optimisticTimestamp = Date.parse(optimisticMessage.createdAt);

    return persistedMessages.some((persistedMessage) => {
        if (persistedMessage.kind !== optimisticMessage.kind) return false;
        if (persistedMessage.body !== optimisticMessage.body) return false;
        if (persistedMessage.sender.id !== optimisticMessage.sender.id) return false;
        if ((persistedMessage.recipient?.id ?? null) !== (optimisticMessage.recipient?.id ?? null)) return false;
        if ((persistedMessage.shapeId ?? null) !== (optimisticMessage.shapeId ?? null)) return false;

        const persistedTimestamp = Date.parse(persistedMessage.createdAt);
        if (!Number.isFinite(optimisticTimestamp) || !Number.isFinite(persistedTimestamp)) {
            return true;
        }

        return Math.abs(persistedTimestamp - optimisticTimestamp) <= 2 * 60 * 1000;
    });
}

export function useCanvasChat({
    roomId,
    enabled = true,
    currentUserId,
    presenceState,
    realtimeChatMessages,
    sendWsMessage,
    lastSyncError = null,
}: UseCanvasChatOptions): UseCanvasChatResult {
    const [participants, setParticipants] = useState<RoomChatBootstrap["participants"]>([]);
    const [groupMessages, setGroupMessages] = useState<PersistedChatMessage[]>([]);
    const [directMessages, setDirectMessages] = useState<PersistedChatMessage[]>([]);
    const [comments, setComments] = useState<PersistedChatMessage[]>([]);
    const [optimisticMessages, setOptimisticMessages] = useState<CanvasChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const realtimeMessagesRef = useRef(realtimeChatMessages);
    const optimisticIdRef = useRef(-1);

    useEffect(() => {
        realtimeMessagesRef.current = realtimeChatMessages;
    }, [realtimeChatMessages]);

    useEffect(() => {
        if (!enabled || roomId === null) {
            setParticipants([]);
            setGroupMessages([]);
            setDirectMessages([]);
            setComments([]);
            setOptimisticMessages([]);
            setError(null);
            setIsLoading(false);
            return;
        }

        let isCancelled = false;
        setIsLoading(true);
        setError(null);

        void apiClient
            .get(`${HTTP_BACKEND}/room/${roomId}/chat/bootstrap`)
            .then((response) => {
                if (isCancelled) return;

                const parsed = RoomChatBootstrapSchema.safeParse(response.data?.data);
                if (!parsed.success) {
                    setError("Unable to read chat history.");
                    setParticipants([]);
                    setGroupMessages([]);
                    setDirectMessages([]);
                    setComments([]);
                    return;
                }

                setParticipants(parsed.data.participants);
                setGroupMessages(
                    mergeById(
                        parsed.data.groupMessages,
                        realtimeMessagesRef.current.filter((message) => message.kind === "group")
                    )
                );
                setDirectMessages(
                    mergeById(
                        parsed.data.directMessages,
                        realtimeMessagesRef.current.filter((message) => message.kind === "direct")
                    )
                );
                setComments(
                    mergeById(
                        parsed.data.comments,
                        realtimeMessagesRef.current.filter((message) => message.kind === "comment")
                    )
                );
            })
            .catch(() => {
                if (isCancelled) return;
                setError("Unable to load chat history.");
                setParticipants([]);
                setGroupMessages([]);
                setDirectMessages([]);
                setComments([]);
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [enabled, roomId]);

    useEffect(() => {
        if (realtimeChatMessages.length === 0) {
            return;
        }

        const incomingGroup = realtimeChatMessages.filter((message) => message.kind === "group");
        const incomingDirect = realtimeChatMessages.filter((message) => message.kind === "direct");
        const incomingComments = realtimeChatMessages.filter((message) => message.kind === "comment");

        if (incomingGroup.length > 0) {
            setGroupMessages((existing) => mergeById(existing, incomingGroup));
        }

        if (incomingDirect.length > 0) {
            setDirectMessages((existing) => mergeById(existing, incomingDirect));
        }

        if (incomingComments.length > 0) {
            setComments((existing) => mergeById(existing, incomingComments));
        }
    }, [realtimeChatMessages]);

    useEffect(() => {
        const persistedMessages = [...groupMessages, ...directMessages, ...comments];
        setOptimisticMessages((existing) =>
            existing.filter((message) => {
                if (message.deliveryState === "failed") {
                    return true;
                }

                return !isMessageResolved(message, persistedMessages);
            })
        );
    }, [comments, directMessages, groupMessages]);

    useEffect(() => {
        if (!isChatRelatedError(lastSyncError)) {
            return;
        }

        setOptimisticMessages((existing) =>
            existing.map((message) =>
                message.deliveryState === "sending"
                    ? {
                        ...message,
                        deliveryState: "failed",
                        failureReason: lastSyncError,
                    }
                    : message
            )
        );
        setError(lastSyncError);
    }, [lastSyncError]);

    const onlineUserIds = useMemo(
        () => new Set((presenceState.presences ?? []).map((presence) => presence.userId)),
        [presenceState.presences]
    );

    const mergedParticipants = useMemo(() => {
        const next = new Map<string, ChatParticipant>();

        for (const participant of participants) {
            next.set(participant.id, participant);
        }

        for (const presence of presenceState.presences ?? []) {
            if (!next.has(presence.userId)) {
                next.set(presence.userId, {
                    id: presence.userId,
                    name: presence.userName,
                    handle: null,
                    photo: null,
                });
            }
        }

        if (currentUserId && !next.has(currentUserId)) {
            const selfPresence = (presenceState.presences ?? []).find((presence) => presence.userId === currentUserId);
            if (selfPresence) {
                next.set(currentUserId, {
                    id: selfPresence.userId,
                    name: selfPresence.userName,
                    handle: null,
                    photo: null,
                });
            }
        }

        return [...next.values()];
    }, [currentUserId, participants, presenceState.presences]);

    const dmParticipants = useMemo(() => {
        return mergedParticipants
            .filter((participant) => participant.id !== currentUserId)
            .map((participant) => ({
                ...participant,
                isOnline: onlineUserIds.has(participant.id),
            }))
            .sort((left, right) => {
                if (left.isOnline !== right.isOnline) {
                    return left.isOnline ? -1 : 1;
                }

                return left.name.localeCompare(right.name);
            });
    }, [currentUserId, mergedParticipants, onlineUserIds]);

    const commentsByShapeId = useMemo(() => {
        const next = new Map<string, CanvasChatMessage[]>();

        for (const comment of [
            ...comments,
            ...optimisticMessages.filter((message) => message.kind === "comment"),
        ]) {
            if (!comment.shapeId) continue;

            const existing = next.get(comment.shapeId) ?? [];
            existing.push(comment);
            next.set(comment.shapeId, existing);
        }

        return next;
    }, [comments, optimisticMessages]);

    const getDirectMessagesForUser = useCallback(
        (partnerUserId: string) =>
            [...directMessages, ...optimisticMessages.filter((message) => message.kind === "direct")].filter((message) => {
                const senderId = message.sender.id;
                const recipientId = message.recipient?.id ?? null;

                return (
                    (senderId === currentUserId && recipientId === partnerUserId) ||
                    (senderId === partnerUserId && recipientId === currentUserId)
                );
            }),
        [currentUserId, directMessages, optimisticMessages]
    );

    const createOptimisticMessage = useCallback(
        (kind: PersistedChatMessage["kind"], body: string, options?: {recipient?: ChatParticipant | null; shapeId?: string | null}) => {
            const selfParticipant =
                mergedParticipants.find((participant) => participant.id === currentUserId) ??
                ((presenceState.presences ?? []).find((presence) => presence.userId === currentUserId)
                    ? {
                        id: currentUserId!,
                        name: (presenceState.presences ?? []).find((presence) => presence.userId === currentUserId)!.userName,
                        handle: null,
                        photo: null,
                    }
                    : null);

            if (!selfParticipant || roomId === null) {
                return null;
            }

            const nextMessage: CanvasChatMessage = {
                id: optimisticIdRef.current,
                roomId,
                kind,
                body,
                shapeId: options?.shapeId ?? null,
                createdAt: new Date().toISOString(),
                sender: selfParticipant,
                recipient: options?.recipient ?? null,
                optimistic: true,
                deliveryState: "sending",
                failureReason: null,
            };

            optimisticIdRef.current -= 1;
            setOptimisticMessages((existing) => [...existing, nextMessage]);
            return nextMessage;
        },
        [currentUserId, mergedParticipants, presenceState.presences, roomId]
    );

    const sendGroupMessage = useCallback(
        (body: string) => {
            if (roomId === null) return false;

            const optimisticMessage = createOptimisticMessage("group", body);
            if (!optimisticMessage) {
                return false;
            }

            const sent = sendWsMessage({
                type: "send_chat_message",
                roomId,
                kind: "group",
                body,
            });
            if (!sent) {
                setOptimisticMessages((existing) =>
                    existing.map((message) =>
                        message.id === optimisticMessage.id
                            ? {
                                ...message,
                                deliveryState: "failed",
                                failureReason: "Chat is waiting for the canvas connection.",
                            }
                            : message
                    )
                );
            }

            return sent;
        },
        [createOptimisticMessage, roomId, sendWsMessage]
    );

    const sendDirectMessage = useCallback(
        (recipientUserId: string, body: string) => {
            if (roomId === null) return false;

            const recipient = mergedParticipants.find((participant) => participant.id === recipientUserId) ?? null;
            const optimisticMessage = createOptimisticMessage("direct", body, {recipient});
            if (!optimisticMessage) {
                return false;
            }

            const sent = sendWsMessage({
                type: "send_chat_message",
                roomId,
                kind: "direct",
                body,
                recipientUserId,
            });
            if (!sent) {
                setOptimisticMessages((existing) =>
                    existing.map((message) =>
                        message.id === optimisticMessage.id
                            ? {
                                ...message,
                                deliveryState: "failed",
                                failureReason: "Direct message could not be sent right now.",
                            }
                            : message
                    )
                );
            }

            return sent;
        },
        [createOptimisticMessage, mergedParticipants, roomId, sendWsMessage]
    );

    const sendComment = useCallback(
        (shapeId: string, body: string) => {
            if (roomId === null) return false;

            const optimisticMessage = createOptimisticMessage("comment", body, {shapeId});
            if (!optimisticMessage) {
                return false;
            }

            const sent = sendWsMessage({
                type: "send_chat_message",
                roomId,
                kind: "comment",
                body,
                shapeId,
            });
            if (!sent) {
                setOptimisticMessages((existing) =>
                    existing.map((message) =>
                        message.id === optimisticMessage.id
                            ? {
                                ...message,
                                deliveryState: "failed",
                                failureReason: "Comment could not be attached right now.",
                            }
                            : message
                    )
                );
            }

            return sent;
        },
        [createOptimisticMessage, roomId, sendWsMessage]
    );

    const displayedGroupMessages = useMemo(
        () => mergeById(groupMessages, optimisticMessages.filter((message) => message.kind === "group")),
        [groupMessages, optimisticMessages]
    );

    const displayedDirectMessages = useMemo(
        () => mergeById(directMessages, optimisticMessages.filter((message) => message.kind === "direct")),
        [directMessages, optimisticMessages]
    );

    const displayedComments = useMemo(
        () => mergeById(comments, optimisticMessages.filter((message) => message.kind === "comment")),
        [comments, optimisticMessages]
    );

    return {
        isLoading,
        error,
        participants: mergedParticipants,
        dmParticipants,
        groupMessages: displayedGroupMessages,
        directMessages: displayedDirectMessages,
        comments: displayedComments,
        commentsByShapeId,
        getDirectMessagesForUser,
        sendGroupMessage,
        sendDirectMessage,
        sendComment,
    };
}
