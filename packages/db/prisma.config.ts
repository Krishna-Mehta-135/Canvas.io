import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

const envCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), "../.env.local"),
  resolve(process.cwd(), "../../.env.local"),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
  }
}

// Resolve the server CA cert (path from env, or fall back to file in repo)
// Turbo requires env vars to be declared, added DB_SSL_CA to turbo.json
const sslCa = process.env.DB_SSL_CA
  ? readFileSync(process.env.DB_SSL_CA).toString()
  : existsSync(resolve(__dirname, "certs/server-ca.pem"))
    ? readFileSync(resolve(__dirname, "certs/server-ca.pem")).toString()
    : undefined;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
    ...(sslCa && {
      ssl: {
        ca: sslCa,
        rejectUnauthorized: true, // verify against our known CA
      },
    }),
  },
});