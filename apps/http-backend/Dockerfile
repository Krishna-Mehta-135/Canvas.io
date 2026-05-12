# ── Stage 1: Base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app

# ── Stage 2: Pruner (The Secret Sauce) ────────────────────────────────────────
FROM base AS pruner
RUN pnpm add -g turbo
COPY . .
# This creates a 'pruned' version of your monorepo with ONLY what http-backend needs
RUN turbo prune http-backend --docker

# ── Stage 3: Builder ──────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the actual source code and build
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @repo/db db:generate
RUN pnpm turbo run build --filter=http-backend...

# ── Stage 4: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 🚨 THE FIX: Instead of pnpm deploy, we copy the built folders directly.
# This ensures @repo/backend-common/dist is actually there.
COPY --from=builder /app .

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser && \
    chown -R appuser:nodejs /app
USER appuser

EXPOSE 3001
CMD ["sh", "-c", "packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/http-backend/dist/index.js"]
