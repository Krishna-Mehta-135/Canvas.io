import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if(err instanceof ApiError){
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors
        })
    }

    console.error("Unhandled API error:", err);

    return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "development" ? err?.message || "Internal Server Error" : "Internal Server Error"
    });
}