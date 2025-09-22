import {ApiError} from "../utils/ApiError";
import {asyncHandler} from "../utils/asyncHandler";
import {registerUserSchema} from "../validation/user.validation";
import { JWT_SECRET } from "@repo/backend-common/config"

const signup = asyncHandler(async (req, res) => {
    //validate with zod
    const validationResult = registerUserSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "User validation failed", validationResult.error.issues);
    }
    //use validated elements
    const { email, password } = validationResult.data;

    //sign the jwt
});
