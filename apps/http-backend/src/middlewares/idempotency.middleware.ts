/**
 * File intent:
 * Provide request-level idempotency for mutation endpoints (`POST/PUT/PATCH/DELETE`)
 * using an `Idempotency-Key` header.
 *
 * Core behavior:
 * - same key + same request body => replay the original response
 * - same key + different body => 409 conflict
 * - concurrent duplicate requests => wait for first completion, then replay
 * - only non-5xx responses are cached and replayed
 */
import crypto from "node:crypto";
import {Request, RequestHandler, Response} from "express";
import {ApiError} from "../utils/ApiError";

type CachedResponse = {
	statusCode: number;
	headers: Record<string, string | string[]>;
	body: any;
	bodyKind: "json" | "send" | "end";
	fingerprint: string;
	expiresAt: number;
};

type PendingEntry = {
	fingerprint: string;
	promise: Promise<CachedResponse>;
	resolve: (response: CachedResponse) => void;
	reject: (error: unknown) => void;
};

type IdempotencyState = {
	pending?: PendingEntry;
	cached?: CachedResponse;
};

const IDEMPOTENCY_WINDOW_MS = Number(process.env.IDEMPOTENCY_WINDOW_MS ?? "600000");
const IDEMPOTENCY_MAX_ENTRIES = Number(process.env.IDEMPOTENCY_MAX_ENTRIES ?? "2000");

// In-memory store is process-local by design. If you need cross-instance
// idempotency guarantees, move this to Redis or a persistent shared store.
const idempotencyStore = new Map<string, IdempotencyState>();

/**
 * Deterministic JSON stringify so semantically equivalent payloads always hash
 * to the same fingerprint regardless of object key order.
 */
function stableStringify(value: any): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	}

	const keys = Object.keys(value).sort();
	return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

/**
 * Request-body fingerprint used to detect key reuse with different payloads.
 */
function hashRequestBody(body: unknown) {
	return crypto.createHash("sha256").update(stableStringify(body ?? null)).digest("hex");
}

/**
 * Builds actor scope for idempotency keys.
 *
 * Authenticated scope is preferred (`user:<id>`). IP fallback is used for
 * unauthenticated endpoints like signup/forgot-password.
 */
function getActorScope(req: Request) {
	if (typeof req.userId === "string" && req.userId.length > 0) {
		return `user:${req.userId}`;
	}

	const forwardedFor = req.headers["x-forwarded-for"];
	if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
		const firstForwardedFor = forwardedFor.split(",")[0];
		if (firstForwardedFor) {
			return `ip:${firstForwardedFor.trim()}`;
		}
	}

	if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
		const firstForwardedFor = forwardedFor[0];
		if (firstForwardedFor) {
			return `ip:${firstForwardedFor.trim()}`;
		}
	}

	return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
}

/**
 * Removes expired cache entries and bounds map size to avoid unbounded memory.
 */
function pruneExpiredEntries(now: number) {
	for (const [key, state] of idempotencyStore.entries()) {
		if (state.cached && state.cached.expiresAt <= now) {
			idempotencyStore.delete(key);
			continue;
		}

		if (!state.cached && !state.pending) {
			idempotencyStore.delete(key);
		}
	}

	if (idempotencyStore.size <= IDEMPOTENCY_MAX_ENTRIES) {
		return;
	}

	const entries = Array.from(idempotencyStore.entries());
	entries.sort((left, right) => {
		const leftExpiry = left[1].cached?.expiresAt ?? Number.POSITIVE_INFINITY;
		const rightExpiry = right[1].cached?.expiresAt ?? Number.POSITIVE_INFINITY;
		return leftExpiry - rightExpiry;
	});

	for (const [key] of entries) {
		if (idempotencyStore.size <= IDEMPOTENCY_MAX_ENTRIES) {
			break;
		}

		idempotencyStore.delete(key);
	}
}

/**
 * Removes headers that should not be replayed verbatim.
 *
 * `content-length` and transfer headers are recalculated by Express.
 */
function sanitizeHeaders(headers: Record<string, unknown>) {
	const sanitized: Record<string, string | string[]> = {};
	const excludedHeaders = new Set(["content-length", "transfer-encoding", "connection", "date"]);

	for (const [key, value] of Object.entries(headers)) {
		if (excludedHeaders.has(key.toLowerCase())) {
			continue;
		}

		if (typeof value === "string" || Array.isArray(value)) {
			sanitized[key] = value;
		}
	}

	return sanitized;
}

/**
 * Only replay responses that are safe to cache.
 *
 * 5xx responses are treated as transient server failures and are not cached.
 */
function isReplayableStatus(statusCode: number) {
	return statusCode < 500;
}

/**
 * Writes previously cached response to the current request.
 */
function replayCachedResponse(res: Response, cached: CachedResponse) {
	res.status(cached.statusCode);
	res.set(cached.headers);

	if (cached.bodyKind === "json") {
		return res.json(cached.body);
	}

	if (cached.bodyKind === "end") {
		return res.end(cached.body);
	}

	return res.send(cached.body);
}

export const idempotencyMiddleware: RequestHandler = async (req, res, next) => {
	// Idempotency is relevant only for mutating methods.
	if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH" && req.method !== "DELETE") {
		return next();
	}

	const headerValue = req.header("Idempotency-Key");
	const idempotencyKey = typeof headerValue === "string" ? headerValue.trim() : "";
	// No idempotency key means pass-through behavior.
	if (!idempotencyKey) {
		return next();
	}

	const fingerprint = hashRequestBody(req.body);
	const storeKey = `${req.method}:${req.baseUrl || ""}:${req.path}:${getActorScope(req)}:${idempotencyKey}`;
	const now = Date.now();
	pruneExpiredEntries(now);

	const existingState = idempotencyStore.get(storeKey);
	if (existingState?.cached) {
		// Same key but different payload is a protocol misuse.
		if (existingState.cached.fingerprint !== fingerprint) {
			throw new ApiError(409, "Idempotency key already used with a different request body");
		}

		return replayCachedResponse(res, existingState.cached);
	}

	if (existingState?.pending) {
		// If the first in-flight request used a different payload, reject.
		if (existingState.pending.fingerprint !== fingerprint) {
			throw new ApiError(409, "Idempotency key already used with a different request body");
		}

		// Wait for the first request to finish and replay its response.
		const cached = await existingState.pending.promise;
		return replayCachedResponse(res, cached);
	}

	let resolvePending!: (response: CachedResponse) => void;
	let rejectPending!: (error: unknown) => void;
	const pendingPromise = new Promise<CachedResponse>((resolve, reject) => {
		resolvePending = resolve;
		rejectPending = reject;
	});

	idempotencyStore.set(storeKey, {
		pending: {
			fingerprint,
			promise: pendingPromise,
			resolve: resolvePending,
			reject: rejectPending,
		},
	});

	let capturedBody: any;
	let capturedBodyKind: CachedResponse["bodyKind"] = "send";
	let captured = false;

	const originalJson = res.json.bind(res);
	const originalSend = res.send.bind(res);
	const originalEnd = res.end.bind(res);

	res.json = ((body: any) => {
		// Capture exactly what the handler wrote so replay is faithful.
		capturedBody = body;
		capturedBodyKind = "json";
		return originalJson(body);
	}) as Response["json"];

	res.send = ((body: any) => {
		capturedBody = body;
		capturedBodyKind = "send";
		return originalSend(body);
	}) as Response["send"];

	res.end = ((chunk?: any, encoding?: any, callback?: any) => {
		if (typeof chunk !== "function") {
			capturedBody = chunk;
			capturedBodyKind = "end";
		}

		return originalEnd(chunk as any, encoding as any, callback as any);
	}) as Response["end"];

	const finalize = () => {
		if (captured) {
			return;
		}

		captured = true;
		const statusCode = res.statusCode;

		if (!isReplayableStatus(statusCode)) {
			// Do not cache server-failure responses.
			idempotencyStore.delete(storeKey);
			rejectPending(new ApiError(statusCode, "Non-replayable idempotency response"));
			return;
		}

		const cachedResponse: CachedResponse = {
			statusCode,
			headers: sanitizeHeaders(res.getHeaders()),
			body: capturedBody,
			bodyKind: capturedBodyKind,
			fingerprint,
			expiresAt: Date.now() + IDEMPOTENCY_WINDOW_MS,
		};

		idempotencyStore.set(storeKey, {cached: cachedResponse});
		resolvePending(cachedResponse);
	};

	const failPending = (error: unknown) => {
		if (captured) {
			return;
		}

		// Ensure waiting duplicates are unblocked and key can be reused later.
		captured = true;
		idempotencyStore.delete(storeKey);
		rejectPending(error);
	};

	res.once("finish", finalize);
	res.once("close", () => {
		// If client disconnects before response flush, fail pending entry.
		if (!res.writableEnded) {
			failPending(new ApiError(499, "Request closed before a response could be cached"));
		}
	});

	try {
		return next();
	} catch (error) {
		failPending(error);
		throw error;
	}
};
