import { CreateRoomSchema } from "@repo/common/types";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";

const createRoom = asyncHandler(async(req,res) => {
    const validationData = CreateRoomSchema.safeParse(req.body)
    if (!validationData.success) {
        throw new ApiError(400, "Incorrect input for creating room", validationData.error.issues)
    }

    const { name } = validationData.data
})

export { createRoom }