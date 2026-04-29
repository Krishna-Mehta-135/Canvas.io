# Canvas.io - Project Context & Instructions

This document provides foundational context and technical mandates for the Canvas.io project. Adhere to these guidelines to maintain architectural integrity and consistency.

## Project Overview

Canvas.io is a real-time collaborative whiteboard application built using a Turborepo monorepo. It leverages a modern stack designed for high availability and low-latency synchronization.

### Architecture

- **Frontend (`apps/web`):** Next.js application providing the user interface, room management, and collaborative canvas experience.
- **HTTP Backend (`apps/http-backend`):** Express REST API handling authentication, room lifecycle, and shape persistence.
- **WebSocket Backend (`apps/ws-backend`):** Real-time server managing socket connections, presence, and canvas synchronization.
- **Canvas Engine (`packages/canvas-engine`):** Core logic for rendering, geometry, and interaction, shared across the frontend.
- **Data Layer:**
  - **PostgreSQL (`packages/db`):** Long-term storage for users, rooms, and shapes via Prisma ORM.
  - **Redis:** Authoritative source for room versions and latest snapshots; also used for low-latency Pub/Sub fan-out.
  - **RabbitMQ:** Durable event queue for cross-node synchronization and background persistence jobs.

## Development Mandates

### 1. Real-time Synchronization Strategy

- **Redis is Authoritative:** Always treat Redis as the source of truth for room versioning and the latest snapshot.
- **Hybrid Transport:** Cross-node sync uses RabbitMQ (durable) and Redis Pub/Sub (low-latency fallback).
- **Idempotency:** Use `actionId` for deduplicating events across different transport layers.
- **Monotonic Versions:** Apply strict monotonic version checks on every incoming snapshot to prevent state regressions.
- **Snapshots over Deltas:** Currently, the system transmits full snapshots. When modifying synchronization logic, maintain this behavior unless explicitly instructed to implement deltas (Phase 2D).

### 2. Backend Conventions

- **Environment Management:** Shared configuration is managed in `packages/backend-common`. Always use `@repo/backend-common/config` for environment variable access.
- **Prisma Client:** Use the shared `@repo/db/client` to ensure consistent database access and connection pooling.
- **Metrics:** `apps/ws-backend` includes a metrics reporter. Ensure new features are instrumented using the existing metrics infrastructure in `ws/metrics.ts`.

### 3. Frontend & Canvas Engine

- **Canvas Interaction:** All canvas-related logic (drawing, tools, geometry) must reside in `packages/canvas-engine`.
- **UI Components:** Use and extend components in `packages/ui` for shared interface elements.
- **State Management:** Canvas state is managed via the `canvas-engine`'s internal store.

### 4. Next.js App Router (Frontend)

- **Suspense for Client Components:** Any client component using `useSearchParams()` MUST be wrapped in a `<Suspense>` boundary. 
  - **Reason:** `useSearchParams()` triggers a "Client-side Rendering (CSR) bailout" during static generation. Without a `Suspense` boundary, Next.js attempts to de-optimize the entire page to dynamic rendering at build time; if the page is being pre-rendered as static, this causes the build to fail.
- **Dynamic Routes:** Ensure dynamic segments (e.g., `[roomId]`) are correctly handled and do not accidentally trigger de-optimization unless intended.

## Key Commands

| Command                             | Description                                       |
| :---------------------------------- | :------------------------------------------------ |
| `pnpm install`                      | Install all dependencies.                         |
| `pnpm db:up`                        | Start PostgreSQL, Redis, and RabbitMQ via Docker. |
| `pnpm dev`                          | Start all applications in development mode.       |
| `pnpm build`                        | Build all apps and packages.                      |
| `pnpm lint`                         | Run ESLint across the workspace.                  |
| `pnpm check-types`                  | Run TypeScript type checking.                     |
| `pnpm format`                       | Format the codebase using Prettier.               |
| `pnpm --filter @repo/db db:migrate` | Apply database migrations.                        |

## Important Paths

- `apps/web/app`: Next.js App Router root.
- `apps/ws-backend/src/ws`: Core WebSocket logic (auth, handlers, sync).
- `packages/canvas-engine/src`: Canvas rendering and geometry logic.
- `packages/db/prisma/schema.prisma`: Authoritative database schema.
- `docs/`: Technical documentation (scaling, resilience, sync architecture).

## Safety & Security

- **No Credentials:** Never log or commit secrets. Use the root `.env` for local development.
- **Durable Persistence:** Ensure that RabbitMQ persistence jobs are never bypassed, as they are critical for long-term data integrity.

## CI/CD & Build Resilience (Lessons Learned)

The project CI/CD pipeline is strict. Keep these mandates in mind to avoid common pipeline failures:

### 1. Prisma & Node Version Compatibility
- **Node 20+ is Required:** Avoid using Node 18 for CI or development. Modern Prisma CLI tools (v7+) utilize ES Modules that cause `ERR_REQUIRE_ESM` crashes in Node 18's CommonJS-centric environment.
- **Explicit Prisma Generation:** Do NOT use `postinstall` hooks in `packages/db/package.json` for `prisma generate`. This makes `pnpm install` fragile and prone to ESM/CJS interop crashes. 
- **CI Workflow:** Always run `pnpm --filter @repo/db db:generate` as an explicit step *after* `pnpm install` in your GitHub Actions.

### 2. Dependency Integrity
- **Local Dev Tools:** Never assume a global tool is available in CI. If a package has a `lint` script calling `eslint`, then `eslint` MUST be listed in that package's `devDependencies`.
- **Strict pnpm:** In a workspace, `pnpm` will not "hoist" binary links for you if they aren't declared in the local `package.json`. If you see `eslint: not found` in CI, check the local `devDependencies`.

### 3. Test Environment Stability (Vitest)
- **Exclude Build Artifacts:** Always ensure `vitest.config.ts` has an `exclude` list that includes `dist/**` and `coverage/**`. If omitted, Vitest may attempt to run compiled `.js` files or coverage reports, leading to duplicate test runs or CommonJS/ESM module errors.
- **Injected Secrets:** Backend configurations (like `packages/backend-common/config.ts`) often throw errors if `JWT_SECRET` is undefined. Since CI has no `.env` file, you must inject dummy secrets into the `test.env` section of your `vitest.config.ts`.

### 4. Next.js Build Constraints
- **Suspense Boundaries:** Any Client Component that utilizes `useSearchParams()` MUST be wrapped in a `<Suspense>` boundary.
- **Prerender Failure:** Failing to do so will cause the static export / production build to crash with a `missing-suspense-with-csr-bailout` error during the `Generating static pages` phase.
