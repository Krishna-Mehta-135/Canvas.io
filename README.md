# Canvas.io

**Canvas.io** is a fast, highly interactive, and privacy-focused virtual whiteboarding application. Built from the ground up for low-latency visual collaboration, Canvas.io gives individuals and distributed teams an infinite canvas to sketch ideas, map out complex systems, draw diagrams, and brainstorm with a natural, hand-drawn feel.

Whether you're outlining software architectures, wireframing user interfaces, or just mapping your thoughts, everything updates in real-time across all connected clients.

## Key Features

- **Infinite Canvas Workspace**: Pan and zoom seamlessly across an endless grid.
- **Rich Drawing Tools**: Access standard whiteboard tools including freehand drawing, rectangles, circles, arrows, lines, and text.
- **Real-Time Multiplayer**: Experience true collaborative drawing with live, multi-user cursor tracking, instant shape synchronization, and presence awareness.
- **Hand-drawn Aesthetics**: Diagrams render with a natural, sketched finish giving your work a personalized touch.
- **End-to-End Privacy First**: Built with user data security at the core, featuring robust authentication boundaries and private room architecture.

---

## Architecture & Tech Stack

Canvas.io is structured as a modern [Turborepo](https://turbo.build/repo) monorepo. It splits concerns into dedicated services to handle the demanding requirements of a real-time drawing app.

### Core Applications (`apps/`)

- **`apps/web` (Next.js 15 Frontend)**  
  The main user-facing application. It statically handles the landing pages, marketing, user dashboards, and authentication. More importantly, it hosts the complex HTML Canvas / WebGL rendering engine where all the drawing, panning, zooming, and client-side interactions happen.

- **`apps/ws-backend` (Node.js/WebSocket Server)**  
  The high-performance, real-time message broker of the platform. This server manages active WebSocket connections for users collaborating in a specific room. It instantly broadcasts shape creation, deletion, dragging events, and live cursor positions to all connected peers, ensuring a lag-free collaborative experience.

- **`apps/http-backend` (Express.js REST API)**  
  Handles traditional HTTP workloads such as user authentication (signup, signin via secure HTTP-only cookies), room creation, initial room state fetching, and user asset management. 

### Shared Packages (`packages/`)

To ensure absolute consistency across the frontend, REST API, and WebSocket server, Canvas.io heavily utilizes shared internal packages:

- **`@repo/ui`**: A shared React component design system built with Tailwind CSS v4 to keep the UI consistent.
- **`@repo/common`**: The source of truth for runtime validation definitions (using Zod) and shared TypeScript types for drawing events, shapes, messages, and payloads.
- **`@repo/db`**: The centralized Prisma ORM client and underlying database schema (PostgreSQL), used by both the HTTP and WS backends for persistence.
- **Config packages**: `@repo/backend-common`, `@repo/eslint-config`, and `@repo/typescript-config` manage shared boilerplate for linting, compilation, and backend environment variables.

---

## Local Development Guide

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18+)
- [pnpm](https://pnpm.io/) (v8+)
- [PostgreSQL](https://www.postgresql.org/) database running locally or via Docker

### 1. Setup

Clone the repository and install all workspace dependencies:

```bash
git clone <your-repo-url>
cd canvas.io
pnpm install
```

### 2. Environment Variables

You must create `.env` files in the necessary applications (`apps/http-backend`, `apps/ws-backend`, and `@repo/db`). You will configure at minimum:

- `DATABASE_URL` (for Prisma to connect to PostgreSQL)
- `JWT_SECRET` (for secure cookie-based auth token generation)

### 3. Database Initialization

Generate the Prisma client and push your schema to the database to set up the tables:

```bash
pnpm --filter @repo/db generate
pnpm --filter @repo/db push
```

### 4. Running the Stack

To spin up all apps and packages in parallel via Turborepo, run:

```bash
pnpm dev
```

The system will start simultaneously:
- **Frontend App**: `http://localhost:3000`
- **HTTP/REST API**: `http://localhost:3001`
- **WebSocket Server**: `ws://localhost:8080` (or your configured WS port)

## Contributing

We welcome contributions! Please adhere to the established ESLint and Prettier rules, and ensure your PRs pass all type checks (`pnpm build`). When working on multiplayer features, take special care to update `@repo/common` schemas to ensure compatibility between the `web` frontend and `ws-backend`.
