import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AccessRequestStatus } from "@prisma/client";

/**
 * Resilience pipeline for all Prisma calls in this package:
 * 1) detect retryable transient DB errors
 * 2) retry with bounded exponential backoff
 * 3) track sustained transient failures in a sliding window
 * 4) open a circuit breaker and fail fast with 503 while DB is unhealthy
 * 5) probe recovery via half-open mode and close when stable
 *
 * This wrapper is shared by all services importing `@repo/db/client`, so API
 * requests and background workers use the same safety rules.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({ connectionString });

// Raw Prisma client instance before resilience behavior is layered on.
const rawPrismaClient = new PrismaClient({ adapter });

// Transient Prisma codes worth retrying because they often recover quickly.
const RETRYABLE_PRISMA_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
]);

// Retryable PostgreSQL/system classes (serialization, restart, overload, etc).
const RETRYABLE_PG_CODES = new Set([
  "40001",
  "40P01",
  "57P01",
  "57P02",
  "57P03",
  "53300",
]);

const DEFAULT_RETRY_ATTEMPTS = Number(process.env.DB_RETRY_ATTEMPTS ?? "3");
const DEFAULT_RETRY_BASE_DELAY_MS = Number(
  process.env.DB_RETRY_BASE_DELAY_MS ?? "75",
);

// Circuit breaker controls (all optional env vars).
const CIRCUIT_BREAKER_ENABLED =
  process.env.DB_CIRCUIT_BREAKER_ENABLED !== "false";
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = Number(
  process.env.DB_CIRCUIT_FAILURE_THRESHOLD ?? "5",
);
const CIRCUIT_BREAKER_WINDOW_MS = Number(
  process.env.DB_CIRCUIT_WINDOW_MS ?? "60000",
);
const CIRCUIT_BREAKER_OPEN_MS = Number(
  process.env.DB_CIRCUIT_OPEN_MS ?? "30000",
);
const CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_THRESHOLD = Number(
  process.env.DB_CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD ?? "2",
);

type CircuitBreakerState = "closed" | "open" | "half-open";

// Circuit runtime state is intentionally process-local and in-memory.
// This keeps the implementation simple and avoids cross-process chatter,
// while still protecting each service instance from cascading DB failures.
let circuitBreakerState: CircuitBreakerState = "closed";

let circuitOpenUntilMs = 0;
let halfOpenSuccessCount = 0;
let halfOpenInFlight = false;
// Stores timestamps for recent transient failures used by the sliding window.
const transientFailureTimestampsMs: number[] = [];

class DbCircuitOpenError extends Error {
  readonly code = "DB_CIRCUIT_OPEN";
  readonly statusCode = 503;
  retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("Database temporarily unavailable; retry shortly");
    this.name = "DbCircuitOpenError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Small delay helper for retry backoff.
 *
 * We keep this as a Promise utility to avoid introducing timers in call-sites
 * and to make retry timing behavior explicit and testable.
 */
function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Maintains a rolling failure window by discarding stale timestamps.
 *
 * Example: with a 60s window, only transient failures from the last 60s
 * count toward opening the breaker.
 */
function pruneFailureWindow(nowMs: number) {
  // Keep only failures inside the configured rolling time window.
  const minTimestamp = nowMs - CIRCUIT_BREAKER_WINDOW_MS;
  while (transientFailureTimestampsMs.length > 0) {
    const oldestTimestamp = transientFailureTimestampsMs[0];
    if (oldestTimestamp === undefined || oldestTimestamp >= minTimestamp) {
      break;
    }

    transientFailureTimestampsMs.shift();
  }
}

/**
 * Moves breaker to OPEN state.
 *
 * OPEN means we fail fast instead of continuing to hit an unhealthy DB,
 * protecting the database and reducing downstream latency amplification.
 */
function openCircuit(nowMs: number) {
  // Open means all requests fail fast until the cool-down period expires.
  circuitBreakerState = "open";
  circuitOpenUntilMs = nowMs + CIRCUIT_BREAKER_OPEN_MS;
  halfOpenSuccessCount = 0;
  halfOpenInFlight = false;
  console.warn("[db-circuit-breaker] opened", {
    failureThreshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    windowMs: CIRCUIT_BREAKER_WINDOW_MS,
    openMs: CIRCUIT_BREAKER_OPEN_MS,
  });
}

/**
 * Moves breaker to CLOSED state and clears all transient counters.
 *
 * Called only after enough successful probes in HALF-OPEN mode.
 */
function closeCircuit() {
  // Closed means normal traffic: calls are allowed and counters reset.
  circuitBreakerState = "closed";

  circuitOpenUntilMs = 0;
  halfOpenSuccessCount = 0;
  halfOpenInFlight = false;
  transientFailureTimestampsMs.length = 0;
  console.info("[db-circuit-breaker] closed");
}

/**
 * Moves breaker from OPEN to HALF-OPEN after cool-down expires.
 *
 * HALF-OPEN is a controlled recovery gate where only limited probe traffic
 * is allowed to verify DB health before full reopening.
 */
function startHalfOpen() {
  // Half-open allows controlled probes before restoring full traffic.
  circuitBreakerState = "half-open";
  halfOpenSuccessCount = 0;
  halfOpenInFlight = false;
  console.info("[db-circuit-breaker] half-open probe window started");
}

/**
 * Gatekeeper that runs before every DB operation.
 *
 * Returns true when the request is a HALF-OPEN probe request so callers can
 * apply stricter success/failure handling after execution.
 */
function checkCircuitBeforeRequest() {
  if (!CIRCUIT_BREAKER_ENABLED) {
    return false;
  }

  const nowMs = Date.now();
  if (circuitBreakerState === "open") {
    if (nowMs >= circuitOpenUntilMs) {
      startHalfOpen();
    } else {
      throw new DbCircuitOpenError(Math.max(0, circuitOpenUntilMs - nowMs));
    }
  }

  if (circuitBreakerState === "half-open") {
    // Allow only one probe at a time while half-open.
    if (halfOpenInFlight) {
      // Short retry hint for callers while probe is in progress.
      throw new DbCircuitOpenError(250);
    }

    halfOpenInFlight = true;
    return true;
  }

  return false;
}

/**
 * Circuit success handler.
 *
 * In CLOSED state we do not need bookkeeping. In HALF-OPEN state we require
 * a success streak to avoid flapping on momentary recoveries.
 */
function onCircuitSuccess(wasHalfOpenRequest: boolean) {
  if (!CIRCUIT_BREAKER_ENABLED) {
    return;
  }

  if (wasHalfOpenRequest) {
    // In half-open mode, we require a small success streak before closing.
    halfOpenInFlight = false;
    halfOpenSuccessCount += 1;
    if (halfOpenSuccessCount >= CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_THRESHOLD) {
      closeCircuit();
    }
  }
}

/**
 * Circuit failure handler.
 *
 * Only transient failures influence circuit transitions. Hard/terminal errors
 * (for example bad queries or validation mistakes) should not open the breaker.
 */
function onCircuitFailure(error: unknown, wasHalfOpenRequest: boolean) {
  if (!CIRCUIT_BREAKER_ENABLED) {
    return;
  }

  if (!isRetryableDbError(error)) {
    // Non-transient errors should not open the circuit breaker.
    if (wasHalfOpenRequest) {
      halfOpenInFlight = false;
    }
    return;
  }

  const nowMs = Date.now();
  if (wasHalfOpenRequest || circuitBreakerState === "half-open") {
    // Any transient failure during half-open immediately re-opens the circuit.
    halfOpenInFlight = false;
    openCircuit(nowMs);
    return;
  }

  // In closed mode, open only after enough failures in the rolling window.
  pruneFailureWindow(nowMs);
  transientFailureTimestampsMs.push(nowMs);

  if (
    transientFailureTimestampsMs.length >= CIRCUIT_BREAKER_FAILURE_THRESHOLD
  ) {
    openCircuit(nowMs);
  }
}

/**
 * Classifies whether an error is likely transient and worth retrying.
 *
 * Detection uses:
 * - known Prisma transient codes
 * - known PostgreSQL transient/restart/overload classes
 * - common transient network error strings
 */
function isRetryableDbError(error: unknown) {
  const err = error as {
    code?: unknown;
    message?: unknown;
    cause?: { code?: unknown };
  };
  const code = typeof err?.code === "string" ? err.code : undefined;
  if (
    code &&
    (RETRYABLE_PRISMA_CODES.has(code) || RETRYABLE_PG_CODES.has(code))
  ) {
    return true;
  }

  const message = typeof err?.message === "string" ? err.message : "";
  if (
    /ECONNRESET|EPIPE|ETIMEDOUT|Connection terminated|timeout/i.test(message)
  ) {
    return true;
  }

  const causeCode =
    typeof err?.cause?.code === "string" ? err.cause.code : undefined;
  return Boolean(causeCode && RETRYABLE_PG_CODES.has(causeCode));
}

/**
 * Executes operation with bounded exponential retry.
 *
 * Retry model:
 * - retries only transient failures
 * - max attempts is strict and finite
 * - backoff doubles each attempt to reduce pressure on an unhealthy DB
 */
async function runWithDbRetry<T>(
  operation: () => Promise<T>,
  attempt = 1,
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    // Retry only transient errors, and only up to a strict max attempt count.
    if (attempt >= DEFAULT_RETRY_ATTEMPTS || !isRetryableDbError(error)) {
      throw error;
    }

    const backoffMs = DEFAULT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    const err = error as { code?: unknown; message?: unknown };
    console.warn("[db-retry] transient database error, retrying", {
      attempt,
      maxAttempts: DEFAULT_RETRY_ATTEMPTS,
      code: err?.code,
      message: err?.message,
    });

    await sleep(backoffMs);
    return runWithDbRetry(operation, attempt + 1);
  }
}

/**
 * Top-level resilience wrapper used by all proxied Prisma calls.
 *
 * Sequence:
 * 1) circuit pre-check (may fail fast)
 * 2) retry execution
 * 3) circuit transition bookkeeping
 */
async function runWithDbProtection<T>(operation: () => Promise<T>): Promise<T> {
  // Circuit decision happens before retry execution.
  const wasHalfOpenRequest = checkCircuitBeforeRequest();

  try {
    const result = await runWithDbRetry(operation);
    onCircuitSuccess(wasHalfOpenRequest);
    return result;
  } catch (error) {
    onCircuitFailure(error, wasHalfOpenRequest);
    throw error;
  }
}

// Cache nested proxies so repeated property access does not allocate new Proxy
// instances for the same Prisma sub-object.
const proxyCache = new WeakMap<object, unknown>();

/**
 * Recursively wraps Prisma objects/functions so all DB operations pass through
 * the same resilience layer without changing caller code.
 */
function wrapPrismaValue(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const cachedProxy = proxyCache.get(value);
  if (cachedProxy) {
    return cachedProxy;
  }

  const proxiedValue = new Proxy(value, {
    get(target, property, receiver) {
      const propertyValue = Reflect.get(target, property, receiver);

      if (typeof propertyValue === "function") {
        // Every Prisma call path funnels through retry + circuit-breaker guards.
        return (...args: unknown[]) =>
          runWithDbProtection(() => propertyValue.apply(target, args));
      }

      return wrapPrismaValue(propertyValue);
    },
  });

  proxyCache.set(value, proxiedValue);
  return proxiedValue;
}

export const prismaClient = wrapPrismaValue(rawPrismaClient) as PrismaClient;

export * from "@prisma/client";
