import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { CreateUserSchema, SignInUserSchema, CreateRoomSchema } from '@repo/common/types';

const signup = asyncHandler(async (req, res) => {
    const validatedData = CreateUserSchema.safeParse(req.body)
    if(!validatedData){
        throw new ApiError(400, "Incorrect input")
    }
}) 

const signin = asyncHandler(async (req, res) => {

})

export{
    signup,
    signin
}