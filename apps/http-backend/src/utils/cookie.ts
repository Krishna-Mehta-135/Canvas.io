import { CookieOptions } from "express";
import { COOKIE_DOMAIN } from "@repo/backend-common/config";

/**
 * Standard cookie options for authentication tokens.
 * Handles production vs development environments and cross-subdomain support.
 */
export function getCookieOptions(maxAgeMs: number): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    // SameSite: 'none' is required for cross-site cookies, especially when
    // frontend and backend are on different domains (e.g. Vercel vs GCP VM).
    // It also REQUIRES 'secure: true'.
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    // Domain scoping (e.g. '.canvassync.tech') allows subdomains to share the cookie.
    domain: isProd ? COOKIE_DOMAIN : undefined,
    maxAge: maxAgeMs,
  };
}
