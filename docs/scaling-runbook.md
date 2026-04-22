# Scaling Runbook

This runbook defines the operational process for validating and improving realtime scale in Canvas.io.

## 1. Baseline SLOs

Use these as initial targets for realtime collaboration:

- Snapshot process latency (server-side): p95 <= 150ms
- Redis fan-out lag (published -> received on peer node): p95 <= 50ms
- Version mismatch rate: < 1% of `canvas_snapshot` messages
- Snapshot commit failure rate: < 0.5%
- Durable publish failure rate: < 0.1%

These targets should be adjusted after the first realistic load test cycle.

## 2. Required Metrics

The WS backend currently emits periodic metrics logs from `apps/ws-backend/src/ws/metrics.ts`.

Track at minimum:

- traffic: `messagesReceived`, `bytesReceived`
- validation failures: `invalidJsonPayloads`, `invalidMessages`, `oversizedMessages`
- protection signals: `rateLimitedSnapshots`
- consistency signals: `versionMismatches`
- write path health: `snapshotsCommitted`, `snapshotCommitFailures`
- latency buckets: `snapshotCommitLatency*`, `snapshotProcessLatency*`, `redisFanoutLag*`
- durable transport health: `durableEventsConsumed`, `durablePublishFailures`
- idempotency and ordering: `duplicateCrossNodeEvents`, `crossNodeVersionRegressions`

## 3. Alert Conditions

Start with simple rule-based alerts:

- `versionMismatches / snapshotsCommitted > 0.02` for 5 min
- `snapshotCommitFailures > 0` for 3 consecutive windows
- `rateLimitedSnapshots > 0` sustained for 10 min
- `redisFanoutLagGt100ms > 0` sustained for 5 min
- `durablePublishFailures > 0` for 3 consecutive windows
- `crossNodeVersionRegressions > 0` sustained for 5 min

## 4. Load Test Procedure

1. Deploy at least 2 WS nodes with Redis and RabbitMQ.
2. Run simulated rooms at 10, 25, and 50 users per room.
3. For each scenario, run at least 10 minutes with burst editing.
4. Collect metrics windows and compute p50/p95/p99 for latency buckets.
5. Record failure counters and mismatch rate.

Exit criteria for a scenario:

- SLOs are met for full run duration.
- No sustained rise in commit failures or fan-out lag.

## 5. Tuning Knobs

WS backend knobs exposed via env vars:

- `WS_MAX_MESSAGE_BYTES`
- `WS_SNAPSHOT_RATE_LIMIT_COUNT`
- `WS_SNAPSHOT_RATE_LIMIT_WINDOW_MS`
- `WS_METRICS_LOG_INTERVAL_MS`
- `RABBITMQ_ROOM_EVENTS_PARTITIONS`
- `RABBITMQ_PREFETCH`

Tuning guidance:

- If `oversizedMessages` spikes: lower client payload size expectations and/or adjust serialization strategy.
- If `rateLimitedSnapshots` spikes: increase limit only after confirming traffic is legitimate.
- If fan-out lag spikes with stable Redis health: reduce snapshot payload size or move toward delta updates.
- If durable consumer lag rises: tune `RABBITMQ_PREFETCH` and verify broker resources.
- If durable publish failures rise: verify broker connectivity and queue durability settings first.

## 6. Next Optimization Trigger

Move to delta updates when either condition is true:

- p95 snapshot process latency exceeds SLO under normal target load.
- Network egress or Redis fan-out lag is dominated by full snapshot payload size.
