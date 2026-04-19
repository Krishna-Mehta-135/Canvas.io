import {NextFunction, Request, Response} from "express";

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler = (requestHandler: RequestHandler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await requestHandler(req, res, next);
        } catch (error: any) {
            const statusCode =
                error.statusCode && error.statusCode >= 100 && error.statusCode <= 600 ? error.statusCode : 500;

            if (statusCode >= 500) {
                console.error("Error in asyncHandler:", error);
            } else {
                console.warn("Request error:", statusCode, error.message || "Unknown error");
            }

            res.status(statusCode).json({
                success: false,
                message: error.message || "Internal Server Error",
            });
        }
    };
};
