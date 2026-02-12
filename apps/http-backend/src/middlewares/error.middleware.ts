import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";

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

    return res.status(500).json({
    success: false,
    message: "Internal Server Error"
    });
}