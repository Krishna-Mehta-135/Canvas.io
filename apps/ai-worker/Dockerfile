# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

# ── Stage 2: installer ────────────────────────────────────────────────────────
FROM base AS installer
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend-common/package.json  ./packages/backend-common/
COPY packages/common/package.json          ./packages/common/
COPY packages/canvas-engine/package.json   ./packages/canvas-engine/
COPY packages/queue-sync/package.json      ./packages/queue-sync/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json   ./packages/eslint-config/
COPY apps/ai-worker/package.json           ./apps/ai-worker/

RUN pnpm install --frozen-lockfile

# ── Stage 3: builder ──────────────────────────────────────────────────────────
# ai-worker has no build script (uses ts-node at runtime), but we still need
# to compile its package dependencies so TypeScript paths resolve correctly.
FROM installer AS builder
WORKDIR /app

COPY turbo.json ./
COPY packages/backend-common  ./packages/backend-common
COPY packages/common          ./packages/common
COPY packages/canvas-engine   ./packages/canvas-engine
COPY packages/queue-sync      ./packages/queue-sync
COPY packages/typescript-config ./packages/typescript-config
COPY apps/ai-worker           ./apps/ai-worker

# Build only the packages ai-worker depends on (not ai-worker itself).
RUN pnpm turbo run build --filter=@repo/common... \
                          --filter=@repo/canvas-engine... \
                          --filter=@repo/queue-sync... \
  || true
# ^^ `|| true` because some packages have no build script — that's fine.

# ── Stage 4: runner ───────────────────────────────────────────────────────────
# ai-worker runs via ts-node so we keep dev deps (typescript, ts-node).
# It's heavier than http/ws but still small — Gemini calls are the bottleneck anyway.
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat curl

WORKDIR /app
ENV NODE_ENV=production

# Copy full installed workspace (needed for ts-node + workspace package imports)
COPY --from=builder /app/node_modules          ./node_modules
COPY --from=builder /app/package.json          ./package.json
COPY --from=builder /app/pnpm-workspace.yaml   ./pnpm-workspace.yaml
COPY --from=builder /app/packages              ./packages
COPY --from=builder /app/apps/ai-worker        ./apps/ai-worker
COPY --from=builder /app/turbo.json            ./turbo.json

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 appuser && \
    chown -R appuser:nodejs /app
USER appuser

WORKDIR /app/apps/ai-worker

# Run with ts-node exactly as defined in the package.json start script.
CMD ["node", "--loader", "ts-node/esm", "--experimental-specifier-resolution=node", "src/index.ts"]