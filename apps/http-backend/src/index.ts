import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { prismaClient } from "@repo/db/client";

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await prismaClient.$connect();
        console.log("Database connected");

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            
        })
    } catch (error) {
        console.log("Failed to connect to database: ", error);
        process.exit(1);
    }
}
