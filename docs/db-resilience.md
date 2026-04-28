# DB Resilience: Retry + Circuit Breaker

This document explains the shared database resilience behavior implemented in `packages/db/src/index.ts`.

The wrapper is applied at the shared Prisma client level (`@repo/db/client`), so all consumers get the same behavior:

- HTTP API path (user-facing)
- WebSocket backend DB calls
- Any background worker importing `@repo/db/client`

## Why This Exists

Database failures in production are usually mixed:

- short transient faults (network hiccups, restart windows, overload spikes)
- sustained faults (database outage, prolonged saturation)

Using retry alone can amplify outages during sustained failures.
Using a circuit breaker alone can be too aggressive for brief blips.

The current design combines both:

1. bounded retry for transient errors
2. circuit breaker fail-fast behavior when transient failures become sustained

## Request Flow

For each Prisma operation:

1. Check circuit breaker state.
2. If open, fail fast with `DB_CIRCUIT_OPEN` (`503` semantics).
3. If allowed, run the operation with bounded exponential retry.
4. Record success/failure into circuit-breaker state machine.

## Circuit Breaker States

- `closed`: normal operation
- `open`: reject requests immediately for a cool-down period
- `half-open`: allow controlled probe traffic to test recovery

Half-open policy:

- one probe in flight at a time
- any transient probe failure re-opens circuit
- a configured number of probe successes closes circuit

## Retryable Error Classes

The wrapper retries only transient candidates, currently including:

- Prisma transient codes (for example connectivity/timeouts)
- PostgreSQL transient classes such as serialization/deadlock/restart/overload
- recognized transient network strings (`ECONNRESET`, `ETIMEDOUT`, etc.)

Non-transient errors (validation, business constraints, query errors) are not retried and do not contribute to circuit opening.

## Environment Variables

### Retry

- `DB_RETRY_ATTEMPTS` (default: `3`)
- `DB_RETRY_BASE_DELAY_MS` (default: `75`)

Backoff is exponential:

- delay for attempt $n$ is `baseDelayMs * 2^(n-1)`

### Circuit Breaker

- `DB_CIRCUIT_BREAKER_ENABLED` (default: enabled, set `false` to disable)
- `DB_CIRCUIT_FAILURE_THRESHOLD` (default: `5`)
- `DB_CIRCUIT_WINDOW_MS` (default: `60000`)
- `DB_CIRCUIT_OPEN_MS` (default: `30000`)
- `DB_CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD` (default: `2`)

## HTTP Behavior

When the circuit is open, DB calls throw `DB_CIRCUIT_OPEN` with `retryAfterMs`.

HTTP error handling maps this to:

- status `503`
- `Retry-After` response header (seconds)

This allows clients to back off instead of hammering the service.

## Operational Notes

- Start conservative in production and tune with telemetry.
- If circuit opens too often during normal load:
  - increase DB capacity or reduce query pressure first
  - then consider raising threshold/window carefully
- If recovery is too slow:
  - reduce `DB_CIRCUIT_OPEN_MS`
  - or lower half-open success threshold

## Future Improvements

- Emit structured metrics for state transitions and fail-fast counts.
- Expose breaker status in health endpoints.
- Add targeted breaker scopes per critical DB domain if needed.
