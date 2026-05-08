/**
 * WebSocket Protocol
 *
 * Defines all message types exchanged between client and WS server.
 * Version tracking prevents overwrite collisions and enables explicit resync.
 */
import { z } from "zod";
const CanvasShapeSchema = z
    .object({
    id: z.string().min(1).max(200),
    type: z.string().min(1).max(64),
})
    .passthrough();
const ChatParticipantSchema = z.object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    handle: z.string().min(1).max(200).nullable(),
    photo: z.string().min(1).max(2048).nullable().optional(),
});
const ChatMessageKindSchema = z.enum(["group", "direct", "comment"]);
const PersistedChatMessageSchema = z.object({
    id: z.number().int().positive(),
    roomId: z.number().int().positive(),
    kind: ChatMessageKindSchema,
    body: z.string().min(1).max(4000),
    shapeId: z.string().min(1).max(200).nullable(),
    createdAt: z.string().min(1).max(64),
    sender: ChatParticipantSchema,
    recipient: ChatParticipantSchema.nullable(),
});
const ActionIdSchema = z.string().min(8).max(128);
const CanvasCrdtMetadataSchema = z.object({
    clock: z.number().int().nonnegative(),
    clientId: z.string().min(1).max(200),
});
export const PresenceCursorSchema = z.object({
    x: z.number().finite(),
    y: z.number().finite(),
});
export const JoinRoomMessageSchema = z.object({
    type: z.literal("join_room"),
    roomId: z.number().int().positive(),
});
export const CanvasSnapshotMessageSchema = z.object({
    type: z.literal("canvas_snapshot"),
    roomId: z.number().int().positive(),
    version: z.number().int().min(0),
    shapes: z.array(CanvasShapeSchema).max(5000),
    deletedShapeIds: z.array(z.string().min(1).max(200)).max(5000).optional(),
    deletionMeta: CanvasCrdtMetadataSchema.nullable().optional(),
});
export const UpdatePresenceMessageSchema = z.object({
    type: z.literal("update_presence"),
    roomId: z.number().int().positive(),
    cursor: PresenceCursorSchema.nullable(),
    selectedIds: z.array(z.string().min(1).max(200)).max(1000),
    tool: z.string().min(1).max(64).nullable(),
});
export const SendChatMessageSchema = z
    .object({
    type: z.literal("send_chat_message"),
    roomId: z.number().int().positive(),
    kind: ChatMessageKindSchema,
    body: z.string().trim().min(1).max(2000),
    recipientUserId: z.string().min(1).max(200).optional(),
    shapeId: z.string().min(1).max(200).optional(),
})
    .superRefine((value, ctx) => {
    if (value.kind === "direct" && !value.recipientUserId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["recipientUserId"],
            message: "recipientUserId is required for direct messages",
        });
    }
    if (value.kind === "comment" && !value.shapeId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["shapeId"],
            message: "shapeId is required for comments",
        });
    }
});
export const ClientWsMessageSchema = z.discriminatedUnion("type", [
    JoinRoomMessageSchema,
    CanvasSnapshotMessageSchema,
    UpdatePresenceMessageSchema,
    SendChatMessageSchema,
]);
export const ChatMessageCreatedSchema = z.object({
    type: z.literal("chat_message_created"),
    message: PersistedChatMessageSchema,
});
export const RoomSnapshotBroadcastEventSchema = z.object({
    type: z.literal("canvas_snapshot_broadcast"),
    roomId: z.number().int().positive(),
    version: z.number().int().min(1),
    shapes: z.array(CanvasShapeSchema).max(5000),
    senderId: z.string().min(1).max(200).optional(),
    deletedShapeIds: z.array(z.string().min(1).max(200)).max(5000).optional(),
    deletionMeta: CanvasCrdtMetadataSchema.nullable().optional(),
    originNodeId: z.string().min(1).max(200),
    actionId: ActionIdSchema,
    publishedAtMs: z.number().int().nonnegative(),
});
