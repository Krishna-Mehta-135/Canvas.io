type CounterKey =
    | "connectionsOpened"
    | "connectionsClosed"
    | "messagesReceived"
    | "bytesReceived"
    | "invalidJsonPayloads"
    | "invalidMessages"
    | "oversizedMessages"
    | "rateLimitedSnapshots"
    | "versionMismatches"
    | "snapshotsCommitted"
    | "snapshotCommitFailures"
    | "redisFanoutEvents";

type Counters = Record<CounterKey, number>;

const totals: Counters = {
    connectionsOpened: 0,
    connectionsClosed: 0,
    messagesReceived: 0,
    bytesReceived: 0,
    invalidJsonPayloads: 0,
    invalidMessages: 0,
    oversizedMessages: 0,
    rateLimitedSnapshots: 0,
    versionMismatches: 0,
    snapshotsCommitted: 0,
    snapshotCommitFailures: 0,
    redisFanoutEvents: 0,
};

let windowCounters: Counters = {...totals};
let reportStarted = false;

function inc(counter: CounterKey, delta = 1) {
    totals[counter] += delta;
    windowCounters[counter] += delta;
}

export function recordConnectionOpened() {
    inc("connectionsOpened");
}

export function recordConnectionClosed() {
    inc("connectionsClosed");
}

export function recordInboundMessage(bytes: number) {
    inc("messagesReceived");
    inc("bytesReceived", Math.max(0, bytes));
}

export function recordInvalidJsonPayload() {
    inc("invalidJsonPayloads");
}

export function recordInvalidMessagePayload() {
    inc("invalidMessages");
}

export function recordOversizedMessage() {
    inc("oversizedMessages");
}

export function recordRateLimitedSnapshot() {
    inc("rateLimitedSnapshots");
}

export function recordVersionMismatch() {
    inc("versionMismatches");
}

export function recordSnapshotCommitted() {
    inc("snapshotsCommitted");
}

export function recordSnapshotCommitFailure() {
    inc("snapshotCommitFailures");
}

export function recordRedisFanoutEvent() {
    inc("redisFanoutEvents");
}

export function startMetricsReporter(intervalMs = Number(process.env.WS_METRICS_LOG_INTERVAL_MS ?? 30000)) {
    if (reportStarted || !Number.isFinite(intervalMs) || intervalMs <= 0) {
        return;
    }

    reportStarted = true;

    setInterval(() => {
        const snapshot = windowCounters;
        windowCounters = {
            connectionsOpened: 0,
            connectionsClosed: 0,
            messagesReceived: 0,
            bytesReceived: 0,
            invalidJsonPayloads: 0,
            invalidMessages: 0,
            oversizedMessages: 0,
            rateLimitedSnapshots: 0,
            versionMismatches: 0,
            snapshotsCommitted: 0,
            snapshotCommitFailures: 0,
            redisFanoutEvents: 0,
        };

        console.info("[WS][metrics]", {
            intervalMs,
            window: snapshot,
            totals,
        });
    }, intervalMs).unref();
}
