import {NextFunction, Request, Response} from "express";

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler = (requestHandler: RequestHandler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
        } catch (error: any) {
            console.log("Error in asyncHandler: ", error);
            res.status(
                error.statusCode && error.statusCode >= 100 && error.statusCode <= 600 ? error.statusCode : 500
            ).json({
                success: false,
                message: error.message || "Internal server error",
            });
        }
    };
};
