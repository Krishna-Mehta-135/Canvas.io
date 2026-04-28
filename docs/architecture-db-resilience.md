# Architecture Deep Dive: Database Resilience Strategy

## Summary

Canvas.io employs a custom resilience layer built on top of the Prisma ORM. This layer uses a combination of **Bounded Exponential Backoff** and **Circuit Breakers** to ensure that database instability does not lead to a total system collapse.

## Intent & Expectations

In a highly concurrent system like Canvas.io, the database is often the primary bottleneck. We expected that:

1.  **Transient Errors should be invisible:** Short-lived network blips or temporary database lock contention should be handled automatically without bubbling up to the user.
2.  **Sustained Failures should "Fail Fast":** If the database is truly down or saturated, the application should stop trying to reach it immediately. This prevents a "Thundering Herd" effect where thousands of retrying requests overwhelm the already struggling database.

## The Approach: Layered Resilience Proxy

We wrapped the shared Prisma client (`@repo/db/client`) in a Proxy-based resilience layer. Every method call (e.g., `prisma.user.findUnique`) passes through this pipeline.

### 1. The Circuit Breaker State Machine

The circuit breaker is an in-memory state machine with three states:

- **CLOSED:** Normal operation. Requests flow through. We track the timestamps of "transient" failures in a sliding window (default: 60s).
- **OPEN:** Sustained failure detected. Requests are blocked immediately. The breaker enters this state if $N$ failures (default: 5) occur within the window.
- **HALF-OPEN:** Testing recovery. After a cooldown period (default: 30s), the breaker allows a single **Probe Request**. If the probe succeeds $M$ times (default: 2), the circuit closes. If any probe fails, it re-opens immediately.

### 2. Bounded Exponential Retry

For errors identified as "transient," we apply a retry strategy:

- **Transient Filter:** We only retry specific Prisma codes (`P1001`, `P1002`, `P1008`, `P1017`, `P2024`) and PostgreSQL codes (`40001` - Serialization, `53300` - Too Many Connections).
- **Backoff:** The delay doubles with each attempt ($Base \times 2^{attempt-1}$), starting at 75ms.
- **Max Attempts:** We limit retries to 3 attempts by default to avoid keeping request threads open for too long.

### 3. Fail-Fast Error Mapping

When the circuit is OPEN, the proxy throws a `DbCircuitOpenError`. The global error middleware in the HTTP backend maps this to:

- **HTTP 503 Service Unavailable**
- **Retry-After Header:** Tells the client exactly how many seconds to wait before trying again.

## Why this approach? (Rationale)

- **Why a custom wrapper?** Standard connection pools manage _connections_, but they don't handle _application-level logic_ like circuit breaking. This wrapper gives us granular control over which errors count as "failures" and which are just "user errors" (like 404s) that should be ignored by the breaker.
- **Why not a Service Mesh?** While tools like Istio provide circuit breaking, they add significant infrastructure complexity. Our process-local wrapper is "zero-config" for developers—they just import the client and get the protection for free.

## Trade-offs

- **Process-Local State:** The circuit breaker state is unique to each Node.js process. If you have 10 API instances, one might be OPEN while the others are CLOSED.
  - _Trade-off:_ We accepted this for **Performance**. Keeping a global breaker state in Redis would add a network round-trip to every single database call.
- **False Positives:** A burst of unrelated transient errors (e.g., several 5-second timeouts) might trip the circuit for everyone.
  - _Trade-off:_ We chose **Safety over Availability**. It's better to tell users "we're busy" than to allow the database to enter a death spiral.

## Future Considerations

We plan to implement **Targeted Breakers**. Instead of one breaker for the whole database, we will have separate breakers for different "domains" (e.g., Auth, Room Metadata, Shapes). This way, if the `Shape` table is locked up, users can still log in and view their room list.
