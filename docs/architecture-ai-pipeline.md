# Architecture Deep Dive: Asynchronous AI Generation

## Summary

The AI Generation Pipeline in Canvas.io allows users to generate complex diagrams from natural language prompts. This process is handled asynchronously using a dedicated `ai-worker`, a RabbitMQ task queue, and a secure internal callback system.

## Intent & Expectations

Interacting with Large Language Models (LLMs) like Google Gemini is inherently slow (taking anywhere from 2 to 15 seconds). Our intent was to:

1.  **Maintain API Responsiveness:** A user shouldn't have to wait for a 10-second HTTP request to finish just to see a "Success" message.
2.  **Isolate Resource Consumption:** AI generation is CPU and memory-intensive (due to large JSON parsing/validation). We wanted to keep this work off the main HTTP and WebSocket servers.
3.  **Ensure Reliability:** LLMs are flaky. They time out, rate-limit, or return malformed JSON. The system must be able to retry these failures without the user losing their progress.

## The Approach: Decoupled Job Pipeline

### 1. The Producer (HTTP Backend)

When a user submits a prompt, the backend validates their session and enqueues a job:

- **Job Payload:** `{ jobId, roomId, prompt, userId }`.
- **Response:** `202 Accepted` with the `jobId`. This releases the user's HTTP connection immediately.

### 2. The Consumer (AI Worker)

The `ai-worker` is a standalone Node.js process designed to survive LLM flakiness.

- **System Instructions:** We use a strict 60-line system instruction that teaches Gemini the exact JSON shape contracts (e.g., `{"type":"rect", "x":n, "y":n, ...}`).
- **Validation:** Raw LLM output is parsed and validated against Zod schemas. If the LLM returns markdown prose or truncated JSON, the worker automatically retries with a "Repair Prompt."
- **Spatial Placement:** To ensure generated diagrams don't overwrite existing user work, the worker extracts the current canvas shapes from the prompt context, calculates their bounding boxes, and performs a **Grid Collision Scan** to find the nearest empty 800x600 region.

### 3. The Callback & Security

Once the generation is complete (or if it fatally fails), the worker must report back.

- **Internal Callback:** The worker sends a `POST /internal/ai/result` to the HTTP backend.
- **Internal Secret:** To prevent external attackers from spoofing AI results, this endpoint is guarded by an `x-internal-secret` header. This secret is shared between the worker and the backend via environment variables.

### 4. Client Recovery

The web client polls `GET /room/:roomId/ai/generate/:jobId`.

- **Persistence:** Results are stored in the PostgreSQL database. This means a user can start a generation on their laptop, close the lid, and see the results on their tablet 10 minutes later.

## Why this approach? (Rationale)

- **Why not Synchronous HTTP?** Most load balancers (and users) have a 30-second patience limit. If the Gemini API is slow or rate-limited, a synchronous request would timeout, leaving the application state ambiguous.
- **Why not WebSocket returns?** Returning results via WebSocket is tempting but fragile. If the user's Wi-Fi blips during the 10-second generation, the result message is lost. Polling against a durable database record is the "old school" but bulletproof solution for long-running tasks.

## Trade-offs

- **UX Latency (Polling):** The user has to wait for the next poll cycle (e.g., every 2 seconds) to see their result.
  - _Trade-off:_ We accepted this for **Architecture Simplicity**. We don't need to track which worker is talking to which user; the database acts as the mailbox.
- **JSON Enforcement:** Gemini sometimes deviates from the schema.
  - _Trade-off:_ We implemented a robust "Repair & Retry" loop in the worker. This adds latency but ensures the frontend never crashes due to malformed shape data.

## Future Considerations

We plan to implement **Streaming Generation**. Instead of waiting for the full 24-shape array, the `ai-worker` will stream individual shapes back to the client as they are generated, making the "AI drawing" feel interactive and instantaneous.
