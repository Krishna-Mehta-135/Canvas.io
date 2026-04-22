# WebSocket Realtime Sync Architecture

This document describes the Redis + RabbitMQ synchronization path for the WebSocket backend.

## Goals

- Keep Redis as the authoritative source of truth for room version and latest snapshot.
- Use RabbitMQ as the durable room-event queue for cross-node replay and reliability.
- Keep Redis Pub/Sub as low-latency fan-out fallback during queue transport incidents.
- Keep the browser protocol unchanged.
- Treat in-memory room state as a cache, not as authority.

## Package Ownership

Redis room sync primitives now live in the shared package `@repo/redis-sync`.
RabbitMQ room queue primitives now live in the shared package `@repo/queue-sync`.

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
4. The server publishes a durable room event to RabbitMQ and a low-latency fallback event to Redis Pub/Sub.
5. All WebSocket nodes consume room events, deduplicate by `actionId`, and apply monotonic version checks.
6. Nodes forward validated events to local room clients.
7. If the client version does not match, the server sends `sync_error` and the latest authoritative snapshot so the client can resync.

## Why Redis + RabbitMQ

Redis is used here for two reasons:

- Versioning: a single Redis key per room holds the latest authoritative version.
- Fast fallback fan-out: Pub/Sub distributes cross-node room updates with low latency.

RabbitMQ is used for durable room-event delivery:

- Durable queueing: events survive node restarts/disconnects.
- Room-level partition routing: routing key is derived from `roomId` partition.
- Backpressure: consumer prefetch controls in-flight event load.
- Replay to nodes: durable per-node queue allows catch-up after node reconnect.

That split gives us the minimum infrastructure needed to support multiple WebSocket servers without changing the frontend protocol.

## What Lives Where

### Redis

- `canvas:room:version:<roomId>`: authoritative version number.
- `canvas:room:snapshot:<roomId>`: latest serialized room snapshot.
- `canvas:room:<roomId>` channel: low-latency fallback cross-node updates.

Redis room events include `publishedAtMs` and `actionId` so WS nodes can measure fan-out lag and deduplicate with durable queue events.

### RabbitMQ

- Exchange (default): `canvas.room.events`.
- Routing keys: `room.partition.<n>` where `n = roomId % partitions`.
- Per-node durable queue: `canvas.room.events.node.<nodeId>`.
- Payload: canonical `canvas_snapshot_broadcast` room event with `actionId`.

### In memory

- Active socket membership for each room.
- A hot cache of the latest room snapshot.

### Postgres

- Durable long-term storage for room shapes.
- Fallback source when Redis does not have a snapshot yet.

## Important Design Rules

- Redis is authoritative for version checks.
- Cross-node events must include `originNodeId` so a node can ignore its own published updates.
- Cross-node events must include `actionId` and pass schema validation before fan-out.
- Nodes apply monotonic room-version checks to avoid stale event regressions.
- The WebSocket protocol stays unchanged for the browser.
- Local in-memory room state may be stale and should only be treated as a cache.

## Horizontal Scaling Status

Horizontal scaling is possible with the current design.

What already enables it:

- Redis-hosted authoritative room version.
- Redis-hosted room snapshot fallback.
- Durable RabbitMQ room-event queue for replay and resiliency.
- Pub/Sub fallback fan-out for fast-path updates.
- `originNodeId` filtering to avoid duplicate local rebroadcast loops.
- `actionId` dedupe across RabbitMQ + Pub/Sub to keep fan-out idempotent.

Current scaling limits:

- Full snapshot payloads are still expensive at high edit rates.
- Per-room events are still full snapshots, so payload size dominates at high edit rates.
- Persistence strategy is still full-room replace, which can bottleneck under heavy load.

## Failure Behavior

- If Redis is temporarily unavailable, room sync cannot safely accept new writes because version authority is missing.
- If a node misses fallback Pub/Sub events, RabbitMQ durable queue replay catches up on reconnect.
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

### Phase 2B: Durable Queue and Ordering

Current status:

- Implemented RabbitMQ durable room-event publication.
- Implemented per-node durable queue consumption with prefetch backpressure control.
- Implemented room-event idempotency using `actionId` dedupe.
- Implemented monotonic version guards for cross-node event application.

See [docs/scaling-runbook.md](docs/scaling-runbook.md) for SLO targets, alert rules, and load-test procedure.

### Phase 2C: Load and Capacity Testing

- Run multi-node WS load tests with realistic room sizes.
- Define room-level and cluster-level SLO thresholds.
- Capture payload byte distributions to identify hot rooms.

### Phase 2D: Protocol Efficiency

- Move from full snapshots to operation/delta events.
- Keep periodic checkpoints for reconnect recovery.
- Reduce fan-out payload cost and DB write amplification.

### Phase 2E: Durable Asynchronous Pipeline

- Add queue/stream-backed workers for persistence and analytics workloads.
- Keep Redis Pub/Sub for live fan-out; use queue/stream for durability and retries.
