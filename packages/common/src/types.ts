import { z } from "zod"

const registerUserSchema = z.object({
    email:     z
                .email("Please enter a valid email address")
                .trim()
                .toLowerCase(),
    password:  z
                .string()
                .min(6 ,"Password must be 8 characters long")
                .max(25 ,"Password must not exceed 20 character")
                .trim()
                .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
                .regex(/[a-z]/, "Password must contain at least one lowercase letter")
                .regex(/[0-9]/, "Password must contain at least one number")
                .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
                .trim(),
})

const loginUserSchema = z.object({
    email :        z
                    .email("Please enter a valid email address")
                    .min(3, "Email or password is required")
                    .trim(),
    password:      z
                    .string()
                    .min(8 ,"Password must be 8 characters long")
                    .max(20 ,"Password must not exceed 20 character")
                    .trim()
})

const CreateRoomSchema = z.object({
    name:       z
                .string()
                .min(3)
                .max(20)
})

export { registerUserSchema, loginUserSchema, CreateRoomSchema }