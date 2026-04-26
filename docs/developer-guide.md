# Developer Guide

This guide provides instructions for setting up the Canvas.io development environment and contributing to the project.

## Prerequisites

Ensure you have the following installed:
*   **Node.js:** >= 18
*   **PNPM:** 10+
*   **Docker Desktop:** For running PostgreSQL, Redis, and RabbitMQ.

## Local Setup

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Infrastructure
Run the following command to start PostgreSQL, Redis, and RabbitMQ via Docker:
```bash
pnpm db:up
```

### 3. Environment Configuration
Copy the template environment file and update the secrets:
```bash
cp .env.example .env
```
Key variables to configure:
*   `JWT_SECRET`: A long random string for token signing.
*   `DATABASE_URL`: Connection string for PostgreSQL.
*   `GEMINI_API_KEY`: Required for the AI generation worker.
*   `INTERNAL_SECRET`: Shared secret between the AI worker and HTTP backend.

### 4. Database Initialization
Generate the Prisma client and apply migrations:
```bash
pnpm --filter @repo/db db:generate
pnpm --filter @repo/db db:migrate
```

### 5. Start Development Servers
Start all applications in development mode:
```bash
pnpm dev
```
*   **Web App:** `http://localhost:3000`
*   **HTTP API:** `http://localhost:3001/api/v1`
*   **WebSocket Backend:** `ws://localhost:8080`

## Common Commands

| Command | Description |
| :--- | :--- |
| `pnpm build` | Build all apps and packages using Turborepo. |
| `pnpm lint` | Run ESLint across the entire workspace. |
| `pnpm format` | Format the codebase using Prettier. |
| `pnpm check-types` | Run TypeScript type checking across the workspace. |
| `pnpm db:down` | Stop the local Docker infrastructure. |
| `pnpm db:logs` | Tail logs for the Docker containers. |

## Contribution Workflow

### Code Style & Linting
*   Canvas.io uses Prettier for formatting and ESLint for static analysis.
*   Configurations are shared via `packages/eslint-config` and `packages/typescript-config`.
*   Always run `pnpm format` before committing changes.

### Testing
*   Ensure that any new features or bug fixes include corresponding test cases.
*   Run `pnpm check-types` to verify type safety.

### PR Guidelines
*   Keep PRs focused on a single logical change.
*   Follow the existing naming conventions and architectural patterns.
*   Update documentation in the `docs/` folder if your changes impact the API, architecture, or setup process.

## Troubleshooting

*   **Infrastructure Issues:** Check container health with `pnpm db:logs`. Ensure ports 5432, 6379, and 5672 are not occupied by other services.
*   **Type Errors:** If you encounter stale types after a schema change, rerun `pnpm --filter @repo/db db:generate`.
*   **Sync Lag:** If WebSocket updates are slow, verify your `REDIS_URL` and `RABBITMQ_URL` connectivity in the `.env` file.
