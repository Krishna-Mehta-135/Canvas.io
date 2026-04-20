# Canvas.io

![Node >=18](https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white)
![pnpm 10](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)
![Turborepo](https://img.shields.io/badge/turbo-monorepo-EF4444?logo=turborepo&logoColor=white)
![Next.js 16](https://img.shields.io/badge/next.js-16-000000?logo=nextdotjs&logoColor=white)
![Prisma](https://img.shields.io/badge/prisma-ORM-2D3748?logo=prisma&logoColor=white)

Canvas.io is a real-time collaborative whiteboard built as a Turborepo monorepo.
It combines a modern Next.js frontend, an Express API, and a WebSocket realtime server, plus shared internal packages for types, DB access, UI, and canvas behavior.

## Table of Contents

- [What You Get](#what-you-get)
- [Architecture](#architecture)
- [Monorepo Structure](#monorepo-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Service Endpoints](#service-endpoints)
- [Troubleshooting](#troubleshooting)

## What You Get

- Infinite canvas UX with room-based collaboration
- Real-time transport via WebSocket server
- REST endpoints for auth, room lifecycle, and shape persistence
- Shared workspace packages for consistency across services
- Docker-powered local Postgres setup

## Architecture

```mermaid
flowchart LR
	U[Browser Client] -->|HTTP| W[apps/web Next.js]
	W -->|REST calls| H[apps/http-backend Express]
	W -->|WS events| S[apps/ws-backend WebSocket]
	H -->|Prisma| D[(PostgreSQL)]
	S -->|Prisma| D
	H --> C[packages/common]
	S --> C
	W --> E[packages/canvas-engine]
```

## Monorepo Structure

### Apps

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js frontend (auth, canvas UI, room pages) |
| `apps/http-backend` | Express REST API |
| `apps/ws-backend` | WebSocket realtime backend |

### Packages

| Path | Purpose |
| --- | --- |
| `packages/db` | Prisma schema, client, migrations |
| `packages/common` | Shared types/schemas |
| `packages/canvas-engine` | Reusable canvas interaction/rendering logic |
| `packages/ui` | Shared UI components |
| `packages/backend-common` | Shared backend env/config loading |
| `packages/eslint-config` | Shared lint config |
| `packages/typescript-config` | Shared TS config |

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local PostgreSQL

```bash
pnpm db:up
```

### 3. Configure environment

Create `.env` (or `.env.local`) in repo root:

```env
JWT_SECRET=replace-with-a-long-random-secret
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/canvas
```

### 4. Generate Prisma client and apply migrations

```bash
pnpm --filter @repo/db db:generate
pnpm --filter @repo/db db:migrate
```

### 5. Start the monorepo

```bash
pnpm dev
```

## Environment Variables

| Variable | Required | Used By | Notes |
| --- | --- | --- | --- |
| `JWT_SECRET` | Yes | `apps/http-backend`, `apps/ws-backend` | Required for auth token signing/verification |
| `PORT` | Yes | `apps/http-backend` | Set to `3001` to match frontend API config |
| `DATABASE_URL` | Yes | `packages/db` and both backends | PostgreSQL connection string |
| `WEB_APP_URL` | Yes for reset email links | `apps/http-backend` | Base URL of the web app, for example `http://localhost:3000` |
| `GMAIL_USER` | Yes for password reset email | `apps/http-backend` | Gmail address used to authenticate SMTP |
| `GMAIL_APP_PASSWORD` | Yes for password reset email | `apps/http-backend` | Google app password for the Gmail account |
| `GMAIL_FROM_EMAIL` | Optional | `apps/http-backend` | Optional display sender, defaults to `GMAIL_USER` |

Notes:

- Backend env loading checks root `.env` / `.env.local` and `packages/db/.env` / `packages/db/.env.local`.
- Current frontend API config points to `http://localhost:3001/api/v1`.

## Scripts

### Root scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run workspace dev tasks via Turborepo |
| `pnpm build` | Build all packages/apps |
| `pnpm lint` | Run lint tasks |
| `pnpm check-types` | Run type checks across workspace |
| `pnpm format` | Format `ts`, `tsx`, and `md` files |
| `pnpm db:up` | Start Postgres container |
| `pnpm db:down` | Stop Postgres container |
| `pnpm db:logs` | Follow Postgres logs |

### Database package scripts

| Command | Description |
| --- | --- |
| `pnpm --filter @repo/db db:generate` | Generate Prisma client |
| `pnpm --filter @repo/db db:push` | Push schema to DB (no migration files) |
| `pnpm --filter @repo/db db:migrate` | Create/apply migrations |

## Service Endpoints

- Web app: `http://localhost:3000`
- HTTP API base: `http://localhost:3001/api/v1`
- WebSocket backend: `ws://localhost:8080`

## Troubleshooting

- If auth/canvas requests fail, ensure HTTP backend is running on port `3001`.
- If Prisma cannot connect, verify `DATABASE_URL` and check DB health with `pnpm db:logs`.
- If either backend crashes on boot, confirm `JWT_SECRET` is set.
- If code changes are not reflected in backend dev processes, rebuild/restart that app (current backend `dev` script compiles then starts).
