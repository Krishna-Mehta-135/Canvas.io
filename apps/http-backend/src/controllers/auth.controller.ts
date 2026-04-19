import {ApiError} from "../utils/ApiError";
import {ApiResponse} from "../utils/ApiResponse";
import {asyncHandler} from "../utils/asyncHandler";
import {CreateUserSchema, SignInUserSchema, CreateRoomSchema} from "@repo/common/types";
import {prismaClient} from "@repo/db/client";
import {comparePassword, hashPassword} from "../utils/password";
import {JWT_SECRET} from "@repo/backend-common/config";
import jwt from "jsonwebtoken";

/**
 * Creates a signed JWT containing user identity used by HTTP and WS auth.
 */
const generateToken = (id: string, name: string) => {
    if (!JWT_SECRET) {
        throw new ApiError(401, "JWT_SECRET is not defined");
    }
    return jwt.sign({userId: id, name}, JWT_SECRET, {
        expiresIn: "7d",
    });
};

const signup = asyncHandler(async (req, res) => {
    const validationResult = CreateUserSchema.safeParse(req.body);
    if (!validationResult.success) {
        throw new ApiError(400, "Enter correct credentials");
    }

    const {name, email, password} = validationResult.data;

    const hashedPassword = await hashPassword(password);

    //we dont check if user exixsts because we have added @unique in db schema. If the user is not unique, it will throw an error and user creation will be blocked.

    //It also solves the concurrency problem of 2 users making same email at once

    try {
        const user = await prismaClient.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        const token = generateToken(user.id, user.name);

        // Store token in httpOnly cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        return res.status(201).json(
            new ApiResponse(
                201,
                {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
                "User created successfully"
            )
        );
    } catch (err: any) {
        if (err.code === "P2002") {
            throw new ApiError(409, "User already exists");
        }
        throw err;
    }
});

const signin = asyncHandler(async (req, res) => {
    const validationResult = SignInUserSchema.safeParse(req.body);

    if (!validationResult.success) {
        throw new ApiError(400, "Invalid email or password");
    }

    const {email, password} = validationResult.data;

    const user = await prismaClient.user.findUnique({
        where: {
            email: email,
        },
    });

    if (!user) {
        throw new ApiError(401, "Invalid credentials");
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
        throw new ApiError(401, "Invalid credentials");
    }

    const token = generateToken(user.id, user.name);

    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            "Login successful"
        )
    );
});

/**
 * Returns the currently authenticated user.
 *
 * Primary route is `/auth/current-user` for clarity.
 * `/auth/me` is kept as a shorthand alias for compatibility.
 * It reads `req.userId` from auth middleware and returns that user's profile.
 */
const getCurrentUser = asyncHandler(async (req, res) => {
    const userId = req.userId;

    if (!userId) {
        throw new ApiError(401, "Unauthorized");
    }

    const user = await prismaClient.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            name: true,
            email: true,
        },
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200).json(new ApiResponse(200, user, "Current user fetched"));
});

export {signup, signin, getCurrentUser};
