function normalizeApiBase(url: string): string {
  const trimmedUrl = url.replace(/\/$/, "");

  if (trimmedUrl.endsWith("/v1")) {
    return trimmedUrl;
  }

  if (trimmedUrl.endsWith("/api")) {
    return `${trimmedUrl}/v1`;
  }

  return `${trimmedUrl}/api/v1`;
}

function getBrowserApiBase(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const { protocol, hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }

  if (hostname.endsWith("canvassync.tech")) {
    return normalizeApiBase(`${protocol}//api.canvassync.tech`);
  }

  return null;
}

function getConfiguredApiBase(): string {
  const browserApiBase = getBrowserApiBase();
  if (browserApiBase) {
    return browserApiBase;
  }

  const rawUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_HTTP_BACKEND ||
    "http://localhost:3001/api/v1";

  return normalizeApiBase(rawUrl);
}

export const HTTP_BACKEND: string = getConfiguredApiBase();
