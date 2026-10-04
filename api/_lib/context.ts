import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { getUser, syncAppUser } from "./supabase";

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

function tokenFromRequest(req: CreateExpressContextOptions["req"]) {
  const headers = (req as unknown as {
    headers?: { cookie?: string; authorization?: string | string[] };
  }).headers;

  if (headers?.cookie) {
    const cookies = parseCookieHeader(headers.cookie);
    if (cookies["sb-access-token"]) return cookies["sb-access-token"];
  }

  const raw = headers?.authorization;
  const authorization = Array.isArray(raw) ? raw[0] : raw;
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

export async function createServerlessContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  const token = tokenFromRequest(opts.req);
  let user: AppUser | null = null;

  if (token) {
    try {
      const authUser = await getUser(token);
      if (authUser) user = await syncAppUser(authUser);
    } catch (error) {
      console.warn("[Auth] Supabase session validation failed:", error);
    }
  }

  return { req: opts.req, res: opts.res, user };
}
