const browserHost =
  typeof window !== "undefined" ? window.location.hostname : "localhost";

export const HTTP_BACKEND =
  process.env.NEXT_PUBLIC_HTTP_BACKEND || `http://${browserHost}:3001/api/v1`;
