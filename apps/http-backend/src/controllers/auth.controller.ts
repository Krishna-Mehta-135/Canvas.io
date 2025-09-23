import {ApiError} from "../utils/ApiError";
import {asyncHandler} from "../utils/asyncHandler";
import { JWT_SECRET } from "@repo/backend-common/config"
import { CreateRoomSchema, registerUserSchema, loginUserSchema } from '@repo/common';

const signup = asyncHandler(async (req, res) => {
    //validate with zod
    const validationResult = registerUserSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "User validation failed at signup", validationResult.error.issues);
    }
    //use validated elements
    const { email, password } = validationResult.data;
    
    //sign the jwt
});

const signin = asyncHandler(async (req, res) => {
    //validate with zod
    const validationResult = loginUserSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "User validation failed at login", validationResult.error.issues);
    }
    //use validated elements
    const { email, password } = validationResult.data;
})
