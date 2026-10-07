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
  activeMembershipId: number | null;
};

function authFromRequest(req: CreateExpressContextOptions["req"]) {
  const headers = (req as unknown as {
    headers?: { cookie?: string; authorization?: string | string[] };
  }).headers;
  const cookies = parseCookieHeader(headers?.cookie ?? "");
  const raw = headers?.authorization;
  const authorization = Array.isArray(raw) ? raw[0] : raw;
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const membership = Number(cookies["condohub-membership"]);
  return {
    accessToken: cookies["sb-access-token"] ?? bearer,
    refreshToken: cookies["sb-refresh-token"] ?? null,
    activeMembershipId: Number.isInteger(membership) && membership > 0 ? membership : null,
  };
}

function sessionCookies(accessToken: string, refreshToken: string, expiresIn: number) {
  return [
    `sb-access-token=${accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${expiresIn}`,
    `sb-refresh-token=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
  ];
}

export async function createServerlessContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  const auth = authFromRequest(opts.req);
  let user: AppUser | null = null;
  let accessToken = auth.accessToken;

  try {
    let authUser = accessToken ? await getUser(accessToken) : null;
    if (!authUser && auth.refreshToken) {
      const refreshed = await refreshSession(auth.refreshToken);
      if (refreshed.data.session) {
        accessToken = refreshed.data.session.access_token;
        opts.res.setHeader("Set-Cookie", sessionCookies(
          refreshed.data.session.access_token,
          refreshed.data.session.refresh_token,
          refreshed.data.session.expires_in,
        ));
        opts.res.setHeader("Cache-Control", "private, no-store");
        authUser = refreshed.data.user ?? await getUser(accessToken);
      }
    }
    if (authUser) user = await syncAppUser(authUser);
  } catch (error) {
    console.warn("[Auth] Supabase session validation failed:", error);
  }

  return { req: opts.req, res: opts.res, user, activeMembershipId: auth.activeMembershipId };
}
