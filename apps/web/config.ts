// Priority:
//   1. NEXT_PUBLIC_API_URL  — set in Vercel dashboard / baked by CI
//   2. NEXT_PUBLIC_HTTP_BACKEND — legacy alias, kept for back-compat
//   3. localhost:3001 — local development fallback only
export const HTTP_BACKEND: string =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_HTTP_BACKEND ||
  "http://localhost:3001/api/v1";
