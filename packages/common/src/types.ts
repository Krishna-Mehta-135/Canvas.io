import { z } from "zod"

const registerUserSchema = z.object({
    email:     z
                .email("Please enter a valid email address")
                .trim()
                .toLowerCase(),
    password:  z
                .string()
                .min(8, "Password must be 8 characters long")
                .max(20, "Password must not exceed 20 characters")
                .trim()
                .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
                .regex(/[a-z]/, "Password must contain at least one lowercase letter")
                .regex(/[0-9]/, "Password must contain at least one number")
                .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    name:      z
                .string()
                .min(2, "Name must be at least 2 characters")
                .max(50, "Name must not exceed 50 characters")
                .trim(),
    photo:     z
                .string()
                .url("Please provide a valid photo URL")
                .optional()
                .default("")
})

const loginUserSchema = z.object({
    email:     z
                .email("Please enter a valid email address")
                .trim(),
    password:  z
                .string()
                .min(8, "Password must be 8 characters long")
                .max(20, "Password must not exceed 20 characters")
                .trim()
})

const CreateRoomSchema = z.object({
    slug:      z
                .string()
                .min(3, "Room slug must be at least 3 characters")
                .max(20, "Room slug must not exceed 20 characters")
                .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
})

export { registerUserSchema, loginUserSchema, CreateRoomSchema }