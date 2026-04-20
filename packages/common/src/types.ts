import {z} from "zod";

export const ROOM_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RoomSlugSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(ROOM_SLUG_REGEX, "Room slug must use lowercase letters, numbers, and hyphens only");

export const CreateUserSchema = z.object({
    email: z.email(),
    password: z.string(),
    name: z.string()
})

export const SignInUserSchema = z.object({
    email: z.email(),
    password: z.string(),
})

export const CreateRoomSchema = z.object({
    slug: RoomSlugSchema,
})

export const RenameRoomSlugSchema = z.object({
    slug: RoomSlugSchema,
});