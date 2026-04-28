/**
 * ai-worker/src/index.ts
 *
 * Standalone Node.js process that:
 *  1. Connects to RabbitMQ and consumes AI generate jobs
 *  2. Calls the Gemini API (gemini-2.5-flash-lite) with a structured prompt
 *  3. Parses + validates the returned JSON shapes
 *  4. POSTs the result back to the HTTP backend via /internal/ai/result
 */

import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { subscribeAiGenerateJobs, type AiGenerateJob } from "@repo/queue-sync";
import { CanvasShapeSchema } from "@repo/common/types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { z } from "zod";

// File intent: Generate robust, complete AI diagrams and recover from malformed/truncated model output.

// Load env from root .env files regardless of current working directory.
const envCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), "../.env.local"),
  resolve(process.cwd(), "../../.env.local"),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET ?? "canvas-internal-dev-secret-2024";
const HTTP_BACKEND_INTERNAL_URL =
  process.env.HTTP_BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001";
const MAX_GENERATION_ATTEMPTS = 3;
const MAX_AUTOMATIC_RATE_LIMIT_WAIT_MS = 90_000;
const MODEL_CANDIDATES = (
  process.env.GEMINI_MODEL_CANDIDATES ??
  "gemini-2.5-flash,gemini-2.5-flash-lite"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
  console.error(
    "[AI Worker] GEMINI_API_KEY is not set. Get one at https://aistudio.google.com",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Gemini system instruction — teaches the model the exact JSON contract
// ---------------------------------------------------------------------------
const SYSTEM_INSTRUCTION = `You are a canvas diagram generator for a collaborative whiteboard app.
Return ONLY a valid JSON array. No markdown, no explanation, no prefix/suffix text.

Allowed shape schemas:
- rect: {"type":"rect","id":"<uuid>","x":n,"y":n,"width":n,"height":n,"stroke":"#hex","fill":"#hex","strokeWidth":2}
- circle: {"type":"circle","id":"<uuid>","centerX":n,"centerY":n,"radiusX":n,"radiusY":n,"stroke":"#hex","fill":"#hex"}
- rhombus: {"type":"rhombus","id":"<uuid>","x":n,"y":n,"width":n,"height":n,"stroke":"#hex","fill":"#hex"}
- arrow: {"type":"arrow","id":"<uuid>","x1":n,"y1":n,"x2":n,"y2":n,"stroke":"#hex","strokeWidth":2}
- line: {"type":"line","id":"<uuid>","x1":n,"y1":n,"x2":n,"y2":n,"stroke":"#hex"}
- text: {"type":"text","id":"<uuid>","x":n,"y":n,"text":"string","fontSize":16,"width":n,"height":24,"stroke":"#hex"}

Layout + quality rules:
- Coordinates: x 100-900, y 80-680.
- First shape MUST be heading text (title) near y 100-120.
- Generate 1 heading + 9-24 content shapes.
- Place labels inside/adjacent to nodes; text width must be > 0 (roughly chars*8), height >= 24.
- Arrows/lines must connect shape edges, not through shape centers.
- When existing shapes are provided in prompt, place all new shapes in empty space (avoid overlap).
- Favor rich structure over minimal outputs: include multiple sections/layers, branching where relevant, and enough supporting nodes to make the diagram actionable.
- Use available canvas tools intentionally: combine rect/circle/rhombus with arrow/line connectors and text labels, instead of only one node style.
- For architecture/workflow/system prompts, aim for at least 3 tiers (clients, services, data/infra) or equivalent logical groupings.

Color palette:
- Blue: fill "#3B82F6", stroke "#1E40AF"
- Green: fill "#10B981", stroke "#047857"
- Amber: fill "#F59E0B", stroke "#B45309"
- Violet: fill "#8B5CF6", stroke "#5B21B6"
- Red: fill "#EF4444", stroke "#991B1B"
- Sky: fill "#06B6D4", stroke "#0891B2"
- Connectors/text: stroke "#94A3B8" or darker matching text color

JSON rules:
- Valid JSON only, double-quoted keys/strings, no trailing commas, no comments.
- Start with '[' and end with ']'.`;

// ---------------------------------------------------------------------------
// Build the Gemini model using getGenerativeModel
// ---------------------------------------------------------------------------
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const modelCache = new Map<
  string,
  ReturnType<typeof genAI.getGenerativeModel>
>();

function getModel(modelName: string) {
  const cached = modelCache.get(modelName);
  if (cached) {
    return cached;
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  modelCache.set(modelName, model);
  return model;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(message: string): number | null {
  const retrySecondsMatch = message.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!retrySecondsMatch) {
    return null;
  }

  const seconds = Number(retrySecondsMatch[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return Math.ceil(seconds * 1000);
}

function summarizeQuotaError(rawMessage: string) {
  const retryAfterMs = parseRetryAfterMs(rawMessage);
  const retryText = retryAfterMs
    ? ` Please retry in about ${Math.max(1, Math.ceil(retryAfterMs / 1000))}s.`
    : " Please retry later or switch to a paid Gemini plan.";

  return {
    retryAfterMs,
    userMessage: `AI provider quota is currently exceeded.${retryText}`,
  };
}

function isRateLimitError(message: string) {
  return /429\s+Too\s+Many\s+Requests|quota exceeded|rate limit/i.test(message);
}

// ---------------------------------------------------------------------------
// UUID generator (RFC 4122 v4)
// ---------------------------------------------------------------------------
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function shapeBounds(shape: Record<string, unknown>): Bounds | null {
  // Accept compact occupancy regions from prompt context directly.
  const minX = Number(shape.minX);
  const minY = Number(shape.minY);
  const maxX = Number(shape.maxX);
  const maxY = Number(shape.maxY);
  if ([minX, minY, maxX, maxY].every(Number.isFinite)) {
    return { minX, minY, maxX, maxY };
  }

  const type = shape.type;
  if (type === "rect" || type === "rhombus") {
    const x = Number(shape.x);
    const y = Number(shape.y);
    const w = Number(shape.width);
    const h = Number(shape.height);
    if ([x, y, w, h].some((v) => !Number.isFinite(v))) return null;
    return { minX: x, minY: y, maxX: x + w, maxY: y + h };
  }

  if (type === "circle") {
    const cx = Number(shape.centerX);
    const cy = Number(shape.centerY);
    const rx = Number(shape.radiusX);
    const ry = Number(shape.radiusY);
    if ([cx, cy, rx, ry].some((v) => !Number.isFinite(v))) return null;
    return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry };
  }

  if (type === "text") {
    const x = Number(shape.x);
    const y = Number(shape.y);
    const w = Number(shape.width);
    const h = Number(shape.height);
    if ([x, y].some((v) => !Number.isFinite(v))) return null;
    return {
      minX: x,
      minY: y,
      maxX: x + (Number.isFinite(w) && w > 0 ? w : 120),
      maxY: y + (Number.isFinite(h) && h > 0 ? h : 24),
    };
  }

  if (type === "arrow" || type === "line") {
    const x1 = Number(shape.x1);
    const y1 = Number(shape.y1);
    const x2 = Number(shape.x2);
    const y2 = Number(shape.y2);
    if ([x1, y1, x2, y2].some((v) => !Number.isFinite(v))) return null;
    return {
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2),
    };
  }

  return null;
}

function boundsOfShapes(shapes: Array<Record<string, unknown>>): Bounds | null {
  let acc: Bounds | null = null;
  for (const shape of shapes) {
    const b = shapeBounds(shape);
    if (!b) continue;
    if (!acc) {
      acc = { ...b };
    } else {
      acc.minX = Math.min(acc.minX, b.minX);
      acc.minY = Math.min(acc.minY, b.minY);
      acc.maxX = Math.max(acc.maxX, b.maxX);
      acc.maxY = Math.max(acc.maxY, b.maxY);
    }
  }
  return acc;
}

function extractCurrentCanvasShapes(
  prompt: string,
): Array<Record<string, unknown>> {
  const marker = "Current canvas";
  const markerIdx = prompt.lastIndexOf(marker);
  if (markerIdx === -1) return [];

  const arrayStart = prompt.indexOf("[", markerIdx);
  if (arrayStart === -1) return [];

  let depth = 0;
  let arrayEnd = -1;
  for (let i = arrayStart; i < prompt.length; i += 1) {
    const ch = prompt[i];
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }

  if (arrayEnd === -1) return [];

  const jsonSlice = prompt.slice(arrayStart, arrayEnd + 1);
  try {
    const parsed = JSON.parse(jsonSlice);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Record<string, unknown> => typeof s === "object" && s !== null,
    );
  } catch {
    return [];
  }
}

function translateShapes(
  shapes: Array<Record<string, unknown>>,
  dx: number,
  dy: number,
): Array<Record<string, unknown>> {
  return shapes.map((shape) => {
    const next = { ...shape };
    if (typeof next.x === "number") next.x = next.x + dx;
    if (typeof next.y === "number") next.y = next.y + dy;
    if (typeof next.centerX === "number") next.centerX = next.centerX + dx;
    if (typeof next.centerY === "number") next.centerY = next.centerY + dy;
    if (typeof next.x1 === "number") next.x1 = next.x1 + dx;
    if (typeof next.y1 === "number") next.y1 = next.y1 + dy;
    if (typeof next.x2 === "number") next.x2 = next.x2 + dx;
    if (typeof next.y2 === "number") next.y2 = next.y2 + dy;
    return next;
  });
}

function intersectsWithPadding(a: Bounds, b: Bounds, padding: number): boolean {
  return !(
    a.maxX + padding <= b.minX ||
    a.minX >= b.maxX + padding ||
    a.maxY + padding <= b.minY ||
    a.minY >= b.maxY + padding
  );
}

function collidesWithAny(
  candidate: Bounds,
  existing: Bounds[],
  padding: number,
): boolean {
  for (const b of existing) {
    if (intersectsWithPadding(candidate, b, padding)) {
      return true;
    }
  }
  return false;
}

function placeGeneratedShapesInEmptyRegion(
  generated: unknown[],
  existingFromPrompt: Array<Record<string, unknown>>,
): unknown[] {
  if (existingFromPrompt.length === 0) return generated;

  const generatedRecords = generated as Array<Record<string, unknown>>;
  const existingBounds = boundsOfShapes(existingFromPrompt);
  const generatedBounds = boundsOfShapes(generatedRecords);

  if (!existingBounds || !generatedBounds) return generated;

  const existingShapeBounds = existingFromPrompt
    .map((shape) => shapeBounds(shape))
    .filter((b): b is Bounds => Boolean(b));
  if (existingShapeBounds.length === 0) return generated;

  const GAP_X = 140;
  const GAP_Y = 110;
  const COLLISION_PADDING = 36;

  // First preference: place to the right of existing content.
  const targetMinX = existingBounds.maxX + GAP_X;
  const targetMinY = Math.max(80, existingBounds.minY);
  const preferredDx = targetMinX - generatedBounds.minX;
  const preferredDy = targetMinY - generatedBounds.minY;
  const preferredCandidate: Bounds = {
    minX: generatedBounds.minX + preferredDx,
    minY: generatedBounds.minY + preferredDy,
    maxX: generatedBounds.maxX + preferredDx,
    maxY: generatedBounds.maxY + preferredDy,
  };

  if (
    !collidesWithAny(preferredCandidate, existingShapeBounds, COLLISION_PADDING)
  ) {
    return translateShapes(generatedRecords, preferredDx, preferredDy);
  }

  // Fallback scan: find first non-overlapping slot in a deterministic grid.
  const scanStartX = Math.max(100, existingBounds.minX);
  const scanStartY = existingBounds.maxY + GAP_Y;
  const strideX = Math.max(
    220,
    generatedBounds.maxX - generatedBounds.minX + GAP_X,
  );
  const strideY = Math.max(
    160,
    generatedBounds.maxY - generatedBounds.minY + GAP_Y,
  );

  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const candidateMinX = scanStartX + col * strideX;
      const candidateMinY = scanStartY + row * strideY;
      const dx = candidateMinX - generatedBounds.minX;
      const dy = candidateMinY - generatedBounds.minY;
      const candidate: Bounds = {
        minX: generatedBounds.minX + dx,
        minY: generatedBounds.minY + dy,
        maxX: generatedBounds.maxX + dx,
        maxY: generatedBounds.maxY + dy,
      };

      if (!collidesWithAny(candidate, existingShapeBounds, COLLISION_PADDING)) {
        return translateShapes(generatedRecords, dx, dy);
      }
    }
  }

  // Last resort: put it below the entire current canvas block.
  const fallbackDx = Math.max(100, existingBounds.minX) - generatedBounds.minX;
  const fallbackDy = existingBounds.maxY + GAP_Y * 2 - generatedBounds.minY;
  return translateShapes(generatedRecords, fallbackDx, fallbackDy);
}

function extractJsonArrayString(rawText: string): string {
  // Strip accidental markdown fences (```json ... ```), then search for the JSON array.
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const startIdx = stripped.indexOf("[");
  const endIdx = stripped.lastIndexOf("]");

  if (startIdx === -1) {
    throw new Error(
      `Gemini response does not contain a JSON array start token '[': ${rawText.slice(0, 240)}`,
    );
  }
  if (endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `Gemini response appears truncated (missing closing ']'): ${rawText.slice(0, 240)}`,
    );
  }

  return stripped.substring(startIdx, endIdx + 1);
}

function validateAndNormalizeShapes(parsed: unknown): unknown[] {
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Gemini response was not a JSON array. Got ${typeof parsed}: ${JSON.stringify(parsed).slice(0, 240)}`,
    );
  }

  // Assign proper UUIDs to any shapes that have placeholder or duplicate IDs.
  const usedIds = new Set<string>();
  const shapesWithIds = (parsed as unknown[]).map((shape) => {
    const s = shape as Record<string, unknown>;
    const existingId = typeof s["id"] === "string" ? s["id"] : "";
    const needsId =
      !existingId || existingId.length < 8 || usedIds.has(existingId);
    const id = needsId ? uuidv4() : existingId;
    usedIds.add(id);
    return { ...s, id };
  });

  const ShapeArraySchema = z.array(CanvasShapeSchema);
  const validated = ShapeArraySchema.safeParse(shapesWithIds);
  if (!validated.success) {
    throw new Error(`Shape validation failed: ${validated.error.message}`);
  }

  return validated.data;
}

function getQualityIssue(shapes: unknown[], prompt: string): string | null {
  const shapeRecords = shapes as Array<Record<string, unknown>>;
  const textShapes = shapeRecords.filter((s) => s.type === "text");
  const nodeShapes = shapeRecords.filter(
    (s) => s.type === "rect" || s.type === "circle" || s.type === "rhombus",
  );
  const edgeShapes = shapeRecords.filter(
    (s) => s.type === "arrow" || s.type === "line",
  );
  const nodeTypeCount = new Set(nodeShapes.map((s) => s.type)).size;
  const architectureLikePrompt =
    /(architecture|system|platform|microservice|infra|pipeline|workflow|process|sequence|journey)/i.test(
      prompt,
    );
  const branchingPrompt =
    /(decision|branch|if\/else|approval|gateway|conditional)/i.test(prompt);

  const minimumShapes = architectureLikePrompt ? 10 : 7;
  if (shapeRecords.length < minimumShapes) {
    return "too_few_shapes";
  }
  if (textShapes.length === 0 || textShapes[0]?.type !== "text") {
    return "missing_heading";
  }
  if (nodeShapes.length < (architectureLikePrompt ? 4 : 2)) {
    return "too_few_nodes";
  }
  if (architectureLikePrompt && nodeTypeCount < 2) {
    return "low_tool_diversity";
  }

  const needsConnectors =
    /(flow|pipeline|process|workflow|architecture|erd|sequence|journey|system)/i.test(
      prompt,
    );
  if (needsConnectors && edgeShapes.length < (architectureLikePrompt ? 3 : 1)) {
    return "missing_connectors";
  }

  if (branchingPrompt) {
    const rhombusCount = shapeRecords.filter(
      (s) => s.type === "rhombus",
    ).length;
    if (rhombusCount < 1) {
      return "missing_decision_nodes";
    }
  }

  return null;
}

function buildAttemptPrompt(
  basePrompt: string,
  attempt: number,
  previousIssue?: string,
): string {
  if (attempt === 0) {
    return basePrompt;
  }

  const issueHint = previousIssue
    ? `Previous attempt issue: ${previousIssue}.`
    : "";
  return `${basePrompt}\n\nRetry constraints:\n${issueHint}\n- Return compact valid JSON array only (no prose).\n- Keep output complete and reasonably detailed (10-24 shapes when prompt implies architecture/workflow; at least 7 otherwise).\n- Ensure first shape is heading text and include connectors for flow/pipeline/architecture prompts.\n- Use multiple node tools (rect/circle/rhombus) when they improve clarity.\n- For decision/branch prompts, include at least one rhombus gateway.\n- Ensure JSON is complete with closing brackets.`;
}

// ---------------------------------------------------------------------------
// Call Gemini and parse the response into validated, complete shape objects.
// ---------------------------------------------------------------------------
async function generateShapesFromPrompt(prompt: string): Promise<unknown[]> {
  let lastError = "Unknown generation failure";
  let previousIssue: string | undefined;
  const existingShapes = extractCurrentCanvasShapes(prompt);
  const models =
    MODEL_CANDIDATES.length > 0 ? MODEL_CANDIDATES : ["gemini-2.5-flash-lite"];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const attemptPrompt = buildAttemptPrompt(prompt, attempt, previousIssue);
    for (const modelName of models) {
      try {
        const result = await getModel(modelName).generateContent(attemptPrompt);
        const rawText = result.response.text();
        const jsonStr = extractJsonArrayString(rawText);

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (err) {
          throw new Error(
            `Gemini returned invalid JSON on attempt ${attempt + 1}: ${(err as Error).message}. Snippet: ${jsonStr.slice(0, 300)}`,
          );
        }

        const normalizedShapes = validateAndNormalizeShapes(parsed);
        const shapes = placeGeneratedShapesInEmptyRegion(
          normalizedShapes,
          existingShapes,
        );
        const qualityIssue = getQualityIssue(shapes, prompt);
        if (qualityIssue) {
          previousIssue = qualityIssue;
          lastError = `Diagram quality check failed (${qualityIssue}) on attempt ${attempt + 1}`;
          continue;
        }

        if (attempt > 0) {
          console.warn(
            `[AI Worker] Recovered generation after retry ${attempt + 1}`,
          );
        }
        return shapes;
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : String(err);

        if (isRateLimitError(rawMessage)) {
          const { retryAfterMs, userMessage } = summarizeQuotaError(rawMessage);
          lastError = userMessage;

          // If this model is rate-limited, immediately try next candidate model.
          if (modelName !== models[models.length - 1]) {
            console.warn(
              `[AI Worker] Rate limit on ${modelName}; trying fallback model`,
            );
            continue;
          }

          // Only auto-wait for short retry windows to avoid hanging long-running jobs.
          if (
            retryAfterMs &&
            retryAfterMs <= MAX_AUTOMATIC_RATE_LIMIT_WAIT_MS &&
            attempt < MAX_GENERATION_ATTEMPTS - 1
          ) {
            const waitMs = retryAfterMs + 500;
            console.warn(
              `[AI Worker] Rate limited; waiting ${waitMs}ms before retry`,
            );
            await sleep(waitMs);
            break;
          }

          throw new Error(userMessage);
        }

        lastError = rawMessage;
      }
    }
  }

  throw new Error(
    `AI generation failed after ${MAX_GENERATION_ATTEMPTS} attempts: ${lastError}`,
  );
}

// ---------------------------------------------------------------------------
// Post result back to HTTP backend
// ---------------------------------------------------------------------------
async function postResult(
  jobId: string,
  shapes?: unknown[],
  errorMessage?: string,
) {
  await axios.post(
    `${HTTP_BACKEND_INTERNAL_URL}/internal/ai/result`,
    { jobId, shapes, errorMessage },
    {
      headers: {
        "x-internal-secret": INTERNAL_SECRET,
        "Content-Type": "application/json",
      },
      timeout: 10_000,
    },
  );
}

// ---------------------------------------------------------------------------
// Job handler
// ---------------------------------------------------------------------------
async function handleAiJob(job: AiGenerateJob): Promise<void> {
  console.log(
    `[AI Worker] Processing job ${job.jobId} — prompt: "${job.prompt.slice(0, 80)}..."`,
  );

  try {
    const shapes = await generateShapesFromPrompt(job.prompt);
    console.log(
      `[AI Worker] Job ${job.jobId} done — generated ${shapes.length} shapes`,
    );
    await postResult(job.jobId, shapes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AI Worker] Job ${job.jobId} failed:`, message);
    try {
      await postResult(job.jobId, undefined, message);
    } catch (postErr) {
      console.error(
        `[AI Worker] Failed to report error for job ${job.jobId}:`,
        postErr,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function start() {
  console.log("[AI Worker] Starting…");
  console.log(`[AI Worker] HTTP backend: ${HTTP_BACKEND_INTERNAL_URL}`);

  await subscribeAiGenerateJobs(handleAiJob);
  console.log("[AI Worker] Subscribed to AI generate queue. Waiting for jobs…");
}

start().catch((err) => {
  console.error("[AI Worker] Fatal startup error:", err);
  process.exit(1);
});
