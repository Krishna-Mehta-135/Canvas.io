# WebSocket Redis Sync Architecture

This document describes the Redis-backed synchronization path for the WebSocket backend.

## Goals

- Keep Redis as the authoritative source of truth for room version and latest snapshot.
- Allow multiple WebSocket servers to broadcast room updates consistently.
- Keep the browser protocol unchanged.
- Treat in-memory room state as a cache, not as authority.

## Package Ownership

Redis room sync primitives now live in the shared package `@repo/redis-sync`.

Why this package exists:

- Avoid duplicated key naming and serialization logic across services.
- Keep Redis contract changes in one place.
- Make horizontal scaling safer by preventing drift between WS nodes and future workers.

Current consumers:

- `apps/ws-backend`

Future consumers:

- background workers (durable persistence pipelines)
- HTTP backend endpoints that may need authoritative room sync reads

## Core Idea

The room snapshot lifecycle is:

1. A client sends `canvas_snapshot` to the WebSocket server.
2. The server validates the request and checks the authoritative room version in Redis.
3. If the client version matches, the server atomically increments the Redis version and stores the new snapshot.
4. The server publishes a room event to Redis Pub/Sub with the new snapshot and version.
5. All WebSocket nodes receive the event and forward it to their local room clients.
6. If the client version does not match, the server sends `sync_error` and the latest authoritative snapshot so the client can resync.

## Why Redis

Redis is used here for two different reasons:

- Versioning: a single Redis key per room holds the latest authoritative version.
- Fan-out: Pub/Sub distributes cross-node room updates with low latency.

That split gives us the minimum infrastructure needed to support multiple WebSocket servers without changing the frontend protocol.

## What Lives Where

### Redis

- `canvas:room:version:<roomId>`: authoritative version number.
- `canvas:room:snapshot:<roomId>`: latest serialized room snapshot.
- `canvas:room:<roomId>` channel: cross-node room updates.

Redis room events also include `publishedAtMs` so WS nodes can measure cross-node fan-out lag.

### In memory

- Active socket membership for each room.
- A hot cache of the latest room snapshot.

### Postgres

- Durable long-term storage for room shapes.
- Fallback source when Redis does not have a snapshot yet.

## Important Design Rules

- Redis is authoritative for version checks.
- Redis events must include `originNodeId` so a node can ignore its own published updates.
- The WebSocket protocol stays unchanged for the browser.
- Local in-memory room state may be stale and should only be treated as a cache.

## Horizontal Scaling Status

Horizontal scaling is possible with the current design.

What already enables it:

- Redis-hosted authoritative room version.
- Redis-hosted room snapshot fallback.
- Pub/Sub fan-out for cross-node room updates.
- `originNodeId` filtering to avoid duplicate local rebroadcast loops.

Current scaling limits:

- Full snapshot payloads are still expensive at high edit rates.
- Pub/Sub has no replay semantics; reconnect paths rely on snapshot recovery.
- Persistence strategy is still full-room replace, which can bottleneck under heavy load.

## Failure Behavior

- If Redis is temporarily unavailable, room sync cannot safely accept new writes because version authority is missing.
- If a node misses a Pub/Sub event while disconnected, the next client mismatch or join will recover the room from Redis or Postgres.
- If Redis has a version but no snapshot, the backend rebuilds the snapshot from Postgres and reattaches it to the Redis version.

## Why This Is Better Than Memory-Only Sync

- Multiple WebSocket processes can stay consistent.
- Version drift becomes a Redis-level problem instead of a per-process problem.
- Room state survives process restarts as long as Redis is available.
- The implementation remains simple enough to evolve toward deltas or a queue later.

## Next Phase Plan

### Phase 2A: Reliability and Observability

- Add metrics: snapshot ack latency, version mismatch rate, Redis operation errors, Pub/Sub handling lag.
- Add alerts for sustained mismatch spikes and Redis failure rates.
- Add health probes that include Redis connectivity and ping latency.

Current status:

- Implemented periodic WS metrics logging.
- Implemented payload-size guardrail and snapshot rate limiting.
- Implemented latency bucket telemetry for snapshot commit, snapshot process path, and Redis fan-out lag.

See [docs/scaling-runbook.md](docs/scaling-runbook.md) for SLO targets, alert rules, and load-test procedure.

### Phase 2B: Load and Capacity Testing

- Run multi-node WS load tests with realistic room sizes.
- Define room-level and cluster-level SLO thresholds.
- Capture payload byte distributions to identify hot rooms.

### Phase 2C: Protocol Efficiency

- Move from full snapshots to operation/delta events.
- Keep periodic checkpoints for reconnect recovery.
- Reduce fan-out payload cost and DB write amplification.

### Phase 2D: Durable Asynchronous Pipeline

- Add queue/stream-backed workers for persistence and analytics workloads.
- Keep Redis Pub/Sub for live fan-out; use queue/stream for durability and retries.
