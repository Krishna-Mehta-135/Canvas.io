import dotenv from "dotenv";
import {resolve} from "node:path";
import {existsSync} from "node:fs";

// Single source of truth for backend env loading.
const cwd = process.cwd();
const envCandidates = [
    resolve(cwd, ".env"),
    resolve(cwd, ".env.local"),
    resolve(cwd, "../../.env"),
    resolve(cwd, "../../.env.local"),
    resolve(cwd, "../../packages/db/.env"),
    resolve(cwd, "../../packages/db/.env.local"),
];

for (const envPath of envCandidates) {
    if (existsSync(envPath)) {
        dotenv.config({path: envPath, quiet: true});
    }
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined");
}

export const JWT_SECRET: string = jwtSecret;
