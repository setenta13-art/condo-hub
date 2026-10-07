import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { getUser, refreshSession, syncAppUser } from "./supabase.js";

export type AppUser = {
  id: number;
  openId: string | null;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AppUser | null;
};

function tokensFromRequest(req: CreateExpressContextOptions["req"]) {
  const headers = (req as unknown as {
    headers?: { cookie?: string; authorization?: string | string[] };
  }).headers;

  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  if (headers?.cookie) {
    const cookies = parseCookieHeader(headers.cookie);
    accessToken = cookies["sb-access-token"] ?? null;
    refreshToken = cookies["sb-refresh-token"] ?? null;
  }

  if (!accessToken) {
    const raw = headers?.authorization;
    const authorization = Array.isArray(raw) ? raw[0] : raw;
    accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  }

  return { accessToken, refreshToken };
}

function setSessionCookies(
  res: CreateExpressContextOptions["res"],
  session: { access_token: string; refresh_token?: string; expires_in: number },
) {
  const cookies = [
    `sb-access-token=${session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${session.expires_in}`,
  ];
  if (session.refresh_token) {
    cookies.push(`sb-refresh-token=${session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Set-Cookie", cookies);
}

export async function createServerlessContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  const { accessToken, refreshToken } = tokensFromRequest(opts.req);
  let user: AppUser | null = null;

  try {
    let authUser = accessToken ? await getUser(accessToken) : null;

    if (!authUser && refreshToken) {
      const refreshed = await refreshSession(refreshToken);
      if (refreshed.data.session && refreshed.data.user) {
        setSessionCookies(opts.res, refreshed.data.session);
        authUser = refreshed.data.user;
      }
    }

    if (authUser) {
      user = await syncAppUser(authUser);
    }
  } catch (error) {
    console.warn("[Auth] Supabase session validation failed:", error);
  }

  return { req: opts.req, res: opts.res, user };
}
