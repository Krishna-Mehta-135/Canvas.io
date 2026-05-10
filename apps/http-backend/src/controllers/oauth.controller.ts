/**
 * OAuth controller — GitHub & Google (no Passport, no extra deps).
 *
 * Flow per provider:
 *   1. `initiate`  — redirect to provider with correct query params.
 *   2. `callback`  — exchange `code` for access-token, fetch user profile,
 *                    upsert User + OAuthAccount, issue cookies, redirect.
 *
 * Error surface: on any failure the user is sent to
 *   <FRONTEND>/signin?error=<slug>
 * so the UI can show a human-readable message.
 */

import { Request, Response } from "express";
import axios from "axios";
import { prismaClient } from "@repo/db/client";
import {
  GH_CLIENT_ID,
  GH_CLIENT_SECRET,
  GH_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  WEB_APP_URL,
} from "@repo/backend-common/config";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/token";
import { getCookieOptions } from "../utils/cookie";

// ─── helpers ─────────────────────────────────────────────────────────────────

const FRONTEND_URL = WEB_APP_URL;
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1"]);

function errorRedirect(res: Response, slug: string) {
  return res.redirect(`${FRONTEND_URL}/signin?error=${slug}`);
}

function getRequestOrigin(req: Request): string | null {
  const forwardedHost = req.get("x-forwarded-host");
  const host = forwardedHost || req.get("host");

  if (!host) {
    return null;
  }

  const protocol = req.get("x-forwarded-proto") || req.protocol;

  return `${protocol}://${host}`;
}

function getOAuthCallbackUrl(
  req: Request,
  provider: "github" | "google",
): string {
  const configuredCallback =
    provider === "github" ? GH_CALLBACK_URL : GOOGLE_CALLBACK_URL;
  const requestOrigin = getRequestOrigin(req);

  if (!requestOrigin) {
    return configuredCallback;
  }

  const requestUrl = new URL(requestOrigin);
  if (LOCALHOST_HOSTS.has(requestUrl.hostname)) {
    return configuredCallback;
  }

  return `${requestOrigin}/api/v1/auth/${provider}/callback`;
}

/** Derive a unique handle base from an arbitrary display name. */
function toHandleBase(rawName: string): string {
  const normalized = rawName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length >= 3 ? normalized.slice(0, 24) : "user";
}

async function allocateUniqueHandle(name: string): Promise<string> {
  const base = toHandleBase(name);
  let handle = base;
  let suffix = 1;
  while (true) {
    const existing = await prismaClient.user.findFirst({
      where: { handle },
      select: { id: true },
    });
    if (!existing) return handle;
    handle = `${base}-${suffix}`;
    suffix += 1;
  }
}

/**
 * Upserts the User row and the linked OAuthAccount row, then issues
 * httpOnly cookies and redirects to the target frontend route.
 */
async function finalizeOAuth(
  res: Response,
  opts: {
    provider: "github" | "google";
    providerAccountId: string;
    email: string;
    name: string;
    photo?: string;
    redirectTarget: string;
  },
) {
  const { provider, providerAccountId, email, name, photo, redirectTarget } =
    opts;

  // 1. Look up an existing OAuth link for this provider + providerAccountId.
  const existingLink = await prismaClient.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: { provider, providerAccountId },
    },
    include: { user: true },
  });

  let userId: string;
  let tokenVersion: number;

  if (existingLink) {
    // Fast path: user already linked this provider.
    userId = existingLink.userId;
    tokenVersion = existingLink.user.tokenVersion ?? 0;

    // Opportunistically update photo if provider supplied one.
    if (photo && existingLink.user.photo !== photo) {
      await prismaClient.user.update({
        where: { id: userId },
        data: { photo },
      });
    }
  } else {
    // 2. Check if an account with this email already exists (email-password or
    //    a different OAuth provider).  Link to it rather than creating a dupe.
    const existingUser = await prismaClient.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      userId = existingUser.id;
      tokenVersion = existingUser.tokenVersion ?? 0;

      // Create the OAuth link so next login skips email lookup.
      await prismaClient.oAuthAccount.create({
        data: { userId, provider, providerAccountId },
      });
    } else {
      // 3. Brand-new user — create user + link in a transaction.
      const handle = await allocateUniqueHandle(name);
      const newUser = await prismaClient.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            email,
            name,
            handle,
            photo: photo ?? null,
            tokenVersion: 0,
            refreshTokenExp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        await tx.oAuthAccount.create({
          data: {
            userId: u.id,
            provider,
            providerAccountId,
          },
        });
        return u;
      });
      userId = newUser.id;
      tokenVersion = 0;
    }
  }

  // 4. Issue tokens & set cookies.
  const user = await prismaClient.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true },
  });

  const accessToken = generateAccessToken(userId, user.name, tokenVersion);
  const refreshToken = generateRefreshToken(userId, user.name, tokenVersion);

  await prismaClient.user.update({
    where: { id: userId },
    data: { refreshTokenExp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });

  res.cookie("accessToken", accessToken, getCookieOptions(15 * 60 * 1000));
  res.cookie("refreshToken", refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

  return res.redirect(redirectTarget);
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

export function githubInitiate(req: Request, res: Response) {
  if (!GH_CLIENT_ID) {
    return errorRedirect(res, "oauth_not_configured");
  }
  const callbackUrl = getOAuthCallbackUrl(req, "github");
  const redirect = (req.query.redirect as string) || "/rooms";
  const state = Buffer.from(JSON.stringify({ redirect })).toString("base64url");

  const params = new URLSearchParams({
    client_id: GH_CLIENT_ID,
    redirect_uri: callbackUrl,
    scope: "user:email read:user",
    state,
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

export async function githubCallback(req: Request, res: Response) {
  if (!GH_CLIENT_ID || !GH_CLIENT_SECRET) {
    return errorRedirect(res, "oauth_not_configured");
  }
  const callbackUrl = getOAuthCallbackUrl(req, "github");

  const code = req.query.code as string | undefined;
  const rawState = req.query.state as string | undefined;

  if (!code) return errorRedirect(res, "oauth_denied");

  // Parse state to recover redirect target.
  let redirectTarget = "/rooms";
  try {
    if (rawState) {
      const parsed = JSON.parse(
        Buffer.from(rawState, "base64url").toString("utf-8"),
      ) as { redirect?: string };
      if (parsed.redirect) redirectTarget = parsed.redirect;
    }
  } catch {
    // ignore malformed state — just use default
  }

  try {
    // Exchange code for access token.
    const tokenRes = await axios.post<{
      access_token?: string;
      error?: string;
    }>(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GH_CLIENT_ID,
        client_secret: GH_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl,
      },
      { headers: { Accept: "application/json" } },
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) return errorRedirect(res, "oauth_token_exchange_failed");

    // Fetch user profile.
    const [profileRes, emailsRes] = await Promise.all([
      axios.get<{
        id: number;
        login: string;
        name: string | null;
        avatar_url: string;
        email: string | null;
      }>("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      }),
      axios.get<Array<{ email: string; primary: boolean; verified: boolean }>>(
        "https://api.github.com/user/emails",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
          },
        },
      ),
    ]);

    const profile = profileRes.data;
    const primaryEmail =
      profile.email ??
      emailsRes.data.find((e) => e.primary && e.verified)?.email ??
      emailsRes.data.find((e) => e.verified)?.email;

    if (!primaryEmail) return errorRedirect(res, "oauth_no_email");

    return await finalizeOAuth(res, {
      provider: "github",
      providerAccountId: String(profile.id),
      email: primaryEmail,
      name: profile.name ?? profile.login,
      photo: profile.avatar_url,
      redirectTarget: `${FRONTEND_URL}${redirectTarget}`,
    });
  } catch (err) {
    console.error("[oauth/github] callback error:", err);
    return errorRedirect(res, "oauth_server_error");
  }
}

// ─── Google ───────────────────────────────────────────────────────────────────

export function googleInitiate(req: Request, res: Response) {
  if (!GOOGLE_CLIENT_ID) {
    return errorRedirect(res, "oauth_not_configured");
  }
  const callbackUrl = getOAuthCallbackUrl(req, "google");
  const redirect = (req.query.redirect as string) || "/rooms";
  const state = Buffer.from(JSON.stringify({ redirect })).toString("base64url");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });

  return res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  );
}

export async function googleCallback(req: Request, res: Response) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return errorRedirect(res, "oauth_not_configured");
  }
  const callbackUrl = getOAuthCallbackUrl(req, "google");

  const code = req.query.code as string | undefined;
  const rawState = req.query.state as string | undefined;

  if (!code) return errorRedirect(res, "oauth_denied");

  let redirectTarget = "/rooms";
  try {
    if (rawState) {
      const parsed = JSON.parse(
        Buffer.from(rawState, "base64url").toString("utf-8"),
      ) as { redirect?: string };
      if (parsed.redirect) redirectTarget = parsed.redirect;
    }
  } catch {
    // ignore
  }

  try {
    // Exchange code for tokens.
    const tokenRes = await axios.post<{
      access_token?: string;
      id_token?: string;
      error?: string;
    }>("https://oauth2.googleapis.com/token", {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    });

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) return errorRedirect(res, "oauth_token_exchange_failed");

    // Fetch user profile via userinfo endpoint.
    const profileRes = await axios.get<{
      sub: string;
      name: string;
      email: string;
      picture?: string;
      email_verified?: boolean;
    }>("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const profile = profileRes.data;

    if (!profile.email_verified) {
      return errorRedirect(res, "oauth_email_not_verified");
    }

    return await finalizeOAuth(res, {
      provider: "google",
      providerAccountId: profile.sub,
      email: profile.email,
      name: profile.name,
      photo: profile.picture,
      redirectTarget: `${FRONTEND_URL}${redirectTarget}`,
    });
  } catch (err) {
    console.error("[oauth/google] callback error:", err);
    return errorRedirect(res, "oauth_server_error");
  }
}
