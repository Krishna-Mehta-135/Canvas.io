// Priority:
//   1. NEXT_PUBLIC_API_URL  — set in Vercel dashboard / baked by CI
//   2. NEXT_PUBLIC_HTTP_BACKEND — legacy alias, kept for back-compat
//   3. localhost:3001 — local development fallback only
const rawUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_HTTP_BACKEND ||
  "http://localhost:3001/api/v1"
).replace(/\/$/, ""); // Remove trailing slash

// Ensure the URL always ends with /v1 to match backend routes.
// If it ends in /api, append /v1. If it doesn't have /api at all, append /api/v1.
export const HTTP_BACKEND: string = rawUrl.endsWith("/v1")
  ? rawUrl
  : rawUrl.endsWith("/api")
    ? `${rawUrl}/v1`
    : `${rawUrl}/api/v1`;
