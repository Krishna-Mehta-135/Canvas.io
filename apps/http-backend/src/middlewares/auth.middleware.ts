import { JwtPayload } from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { Request, Response, NextFunction } from 'express';
import jwt  from "jsonwebtoken";



declare global{
    namespace Express{
        interface Request{
            user?: IUser //IUSer in models
        }
    }
}

// JWT payload interface
interface JwtPayload {
    id: string;
    iat?: number;
    exp?: number;
}

const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if(req.headers.authorization && req.headers.authorization.startsWith("Bearer")){
        try {
            const token = req.headers.authorization.split(" ")[1]
            if (!process.env.JWT_SECRET) {
                throw new Error("JWT_SECRET is not defined in environment variables.");
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET) as unknown as JwtPayload;
            req.user = await User.findById(decoded.id).select("-password");
            
            if (!req.user) {
                return res.status(401).json(
                    new ApiResponse(401, null, "User not found")
                );
            }
            return next()
        } catch (error: any) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json(
                    new ApiResponse(401, null, "Token expired. Please login again.")
                );
            }
            return res.status(401).json(
                new ApiResponse(401, null, "Not authorized. Token failed.")
            );
        }
    }
})