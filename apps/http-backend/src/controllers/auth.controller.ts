import {ApiError} from "../utils/ApiError";
import {asyncHandler} from "../utils/asyncHandler";
import {registerUserSchema} from "../validation/user.validation";

const signup = asyncHandler(async (req, res) => {
    //validate with zod
    const validationResult = registerUserSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "User validation failed", validationResult.error.issues);
    }
    //use validated elements
    const {username, email, password} = validationResult.data;


});
