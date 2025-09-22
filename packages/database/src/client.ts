import {PrismaClient} from "../generated/prisma";

declare global {
    var process: {
        env: {
            NODE_ENV?: string;
        };
    };
}

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ["query"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
