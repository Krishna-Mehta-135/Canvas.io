import "@repo/backend-common/config";
import app from "./app";
import { prismaClient } from "@repo/db/client";

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        //$connect() starts the db when the server starts so we can fail early.
        //Otherwise prisma defaults to lazy loading and waits until first req is made.
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

startServer();