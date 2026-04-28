# Codebase Walkthrough

This document provides a guided tour of the Canvas.io codebase, explaining the roles and inner workings of its various modules.

## Monorepo Structure

Canvas.io is a Turborepo monorepo, organized into `apps/` and `packages/`.

### Applications (`apps/`)

- **`web`:** The Next.js frontend. Handles user authentication, room management, and the interactive canvas.
- **`http-backend`:** An Express-based REST API. Manages the "cold" lifecycle of the application (users, room metadata, access requests).
- **`ws-backend`:** A high-performance WebSocket server. Handles "hot" real-time synchronization, presence, and chat.
- **`ai-worker`:** A standalone queue consumer. Integrates with the Gemini API to generate canvas shapes from text prompts.

### Core Packages (`packages/`)

- **`canvas-engine`:** The core logic for rendering, geometry, and canvas interaction. Shared across the web app.
- **`db`:** Authoritative Prisma schema and database client wrapper with built-in resilience (retry/circuit-breaker).
- **`common`:** Shared TypeScript types, Zod schemas, and WebSocket protocol definitions used by both frontend and backend.
- **`redis-sync`:** Utilities for managing authoritative room state (versioning/snapshots) in Redis.
- **`queue-sync`:** Primitives for durable messaging using RabbitMQ.
- **`backend-common`:** Shared configuration and environment variable management for backend services.
- **`ui`:** A shared library of React components for a consistent UI/UX.

---

## Frontend & Canvas Engine

The interaction between the Next.js frontend and the custom canvas engine is the heart of Canvas.io.

### `packages/canvas-engine`

The engine is decoupled from React to ensure high performance and smooth rendering (60+ FPS).

- **`renderer.ts`:** Handles the drawing loop using the HTML5 Canvas API. Optimized to only re-render dirty regions where possible.
- **`store.ts`:** A custom state management system (similar to Redux but lighter) that tracks shapes, selection, and viewport.
- **`geometry.ts`:** Pure mathematical functions for hit detection, bounding boxes, and path calculations.
- **`events.ts`:** Manages raw browser events (mouse, touch, keyboard) and translates them into canvas actions (drag, resize, select).

### `apps/web` Sync Hooks

The web app bridges the engine with the backend using specialized hooks:

- **`useCanvasSync.ts`:**
  - **Throttling:** Batches local canvas changes and sends them as snapshots to the WebSocket server.
  - **Monotonic Hydration:** Receives remote snapshots and updates the local engine state only if the remote version is newer.
  - **Drag-Burst Detection:** Temporarily increases the sync frequency during active dragging for ultra-low latency feedback to peers.
- **`useCanvasChat.ts`:** Manages the real-time chat state, including room-wide messages, direct messages, and shape-specific comments.

---

## Backend Modules

### `apps/ws-backend`

The WebSocket server is designed for horizontal scalability.

- **Stateless logic:** It doesn't rely on in-memory state for authority; it always checks Redis.
- **Cross-node communication:** Uses RabbitMQ to ensure that a snapshot received by one node is broadcast to all other nodes serving the same room.

### `apps/http-backend`

Focuses on durability and security.

- **Auth Middleware:** Validates JWTs from cookies and attaches the user object to requests.
- **Idempotency:** Uses a middleware to prevent duplicate operations (like creating multiple rooms or sending multiple access requests) on network retries.

### `packages/db` Resilience Wrapper

Every database call is wrapped in a logic that handles:

- **Transient Retries:** Automatically retries on network hiccups or database lock contention.
- **Circuit Breaking:** Stops sending requests to the database if it detects a high failure rate, protecting the system from cascading failures.
