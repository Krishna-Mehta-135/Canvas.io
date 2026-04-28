# Architecture Deep Dive: Monorepo Strategy & Shared Packages

## Summary

Canvas.io uses a **Monorepo Strategy** powered by **Turborepo** and **PNPM Workspaces**. This design allows us to share critical logic (like the rendering engine, protocol types, and database resilience) across multiple applications while maintaining a single version of truth.

## The "Shared Package" Philosophy

In a distributed system, code duplication is a major source of bugs. If the `http-backend` and `ws-backend` have different ideas about the `Shape` schema, the system will eventually crash. We solve this by moving all common logic into `packages/`.

### 1. `packages/common`: The Protocol Contract

This package contains Zod schemas and TypeScript types that define the **API Surface** and the **WebSocket Protocol**.

- **Single Source of Truth:** Both the Next.js frontend and the Node.js backend import from `@repo/common`. If a developer changes a field in the `Shape` schema, both apps will immediately show TypeScript errors until they are updated.

### 2. `packages/db`: The Resilient Data Layer

Instead of each app managing its own database connection, they all use `@repo/db/client`.

- **Consistency:** Every app automatically gets the **Circuit Breaker** and **Exponential Retry** logic described in our [Database Resilience Strategy](architecture-db-resilience.md).
- **Centralized Migrations:** Prisma schema and migrations live here, ensuring that database changes are version-controlled alongside the code that uses them.

### 3. `packages/canvas-engine`: The Rendering Logic

The engine is shared so that we can potentially build a **Native Mobile App** or a **Desktop CLI** tool in the future that uses the same rendering and geometry logic as the web app.

## Build Pipeline: Turborepo

We use Turborepo to manage the build graph.

- **Remote Caching:** Turborepo "remembers" the output of previous builds. If you only change code in `apps/web`, Turbo will skip the build process for `apps/http-backend` and `packages/db`, reducing CI times by up to 80%.
- **Parallel Execution:** Tasks like `lint`, `check-types`, and `build` run in parallel across all apps and packages, fully utilizing multi-core CPUs.

## Dependency Management: PNPM Workspaces

PNPM is used for its superior speed and disk efficiency.

- **Content-Addressable Storage:** Even with 4 different apps, shared dependencies (like `lodash` or `zod`) are only stored on disk once.
- **Strictness:** PNPM prevents "Phantom Dependencies" (using a package that isn't explicitly listed in your `package.json`), which makes the monorepo much more stable.

## Configuration Strategy: `backend-common`

Managing environment variables in a monorepo can be a nightmare.

- **Centralized Config:** The `packages/backend-common` package provides a unified `config` object.
- **Validation:** It uses Zod to validate the `.env` file at startup. If a critical variable like `JWT_SECRET` is missing, the app will fail to start with a clear error message, rather than crashing later in production.

## Why this approach? (Rationale)

- **Why a Monorepo?**
  - **Atomic Commits:** You can update a shared schema and both consumers in a single PR. In a multi-repo setup, this would require 3 separate PRs and careful deployment coordination.
  - **Shared Standards:** Every app uses the same `eslint-config` and `typescript-config`, ensuring a consistent code style across the entire project.

## Trade-offs

- **Complexity:** The initial setup of a monorepo is harder than a single standalone app. Developers must learn how `pnpm` workspaces and `turbo.json` work.
- **CI Load:** A change in a "leaf" package (like `common`) triggers a rebuild and test run for almost every app in the repository.

## Future Considerations

As the team grows, we plan to implement **Turborepo Remote Cache** (using Vercel or a self-hosted S3 bucket). This will allow developers to share build artifacts across their machines, making "clean builds" almost instantaneous.
