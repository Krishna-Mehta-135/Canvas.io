# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

# ── Stage 2: installer ────────────────────────────────────────────────────────
# Install full monorepo dep tree so Turbo can build everything.
FROM base AS installer
WORKDIR /app

# Manifests first — cache-stable until lock-file changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend-common/package.json  ./packages/backend-common/
COPY packages/common/package.json          ./packages/common/
COPY packages/db/package.json              ./packages/db/
COPY packages/queue-sync/package.json      ./packages/queue-sync/
COPY packages/redis-sync/package.json      ./packages/redis-sync/
COPY packages/canvas-engine/package.json   ./packages/canvas-engine/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json   ./packages/eslint-config/
COPY apps/http-backend/package.json        ./apps/http-backend/

RUN pnpm install --frozen-lockfile

# ── Stage 3: builder ──────────────────────────────────────────────────────────
FROM installer AS builder
WORKDIR /app

COPY turbo.json ./
COPY packages/backend-common  ./packages/backend-common
COPY packages/common          ./packages/common
COPY packages/db              ./packages/db
COPY packages/queue-sync      ./packages/queue-sync
COPY packages/redis-sync      ./packages/redis-sync
COPY packages/canvas-engine   ./packages/canvas-engine
COPY packages/typescript-config ./packages/typescript-config
COPY apps/http-backend        ./apps/http-backend

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN pnpm --filter @repo/db db:generate
RUN pnpm turbo run build --filter=@repo/*

RUN pnpm turbo run build --filter=http-backend...

# ── Stage 4: pruner ───────────────────────────────────────────────────────────
# Resolve only production deps for http-backend — no devDeps, no workspace links.
FROM builder AS pruner
WORKDIR /app

RUN pnpm config set inject-workspace-packages true && \
    pnpm deploy --filter=http-backend --prod /pruned/http-backend

# ── Stage 5: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat curl

WORKDIR /app
ENV NODE_ENV=production

# Copy the pruned app which includes the workspace dependencies
COPY --from=pruner /pruned/http-backend .

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 appuser && \
    chown -R appuser:nodejs /app
USER appuser

EXPOSE 3001
CMD ["node", "dist/index.js"]