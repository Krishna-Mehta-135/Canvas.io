import {z} from "zod";

export const CreateUserSchema = z.object({
    email: z.email(),
    password: z.string(),
    name: z.string()
})

export const SignInUserSchema = z.object({
    email: z.string().min(3).max(20),
    password: z.string(),
})

export const CreateRoomSchema = z.object({
    room: z.string().min(3).max(20)   
})