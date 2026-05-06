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
COPY packages/db/package.json              ./packages/db/
COPY packages/queue-sync/package.json      ./packages/queue-sync/
COPY packages/redis-sync/package.json      ./packages/redis-sync/
COPY packages/canvas-engine/package.json   ./packages/canvas-engine/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json   ./packages/eslint-config/
COPY apps/ws-backend/package.json          ./apps/ws-backend/

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
COPY apps/ws-backend          ./apps/ws-backend

RUN pnpm turbo run build --filter=ws-backend...

# ── Stage 4: pruner ───────────────────────────────────────────────────────────
FROM builder AS pruner
WORKDIR /app

RUN pnpm deploy --filter=ws-backend --prod /pruned/ws-backend

# ── Stage 5: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat curl

WORKDIR /app
ENV NODE_ENV=production

COPY --from=pruner  /pruned/ws-backend/node_modules  ./node_modules
COPY --from=builder /app/apps/ws-backend/dist         ./dist
COPY --from=builder /app/apps/ws-backend/package.json ./

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 appuser && \
    chown -R appuser:nodejs /app
USER appuser

EXPOSE 8081
CMD ["node", "dist/index.js"]