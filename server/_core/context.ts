import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { getSupabaseUser, upsertAppUser } from "../supabase";

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

function getAccessToken(req: CreateExpressContextOptions["req"]) {
  const headers = (req as unknown as {
    headers?: { cookie?: string; authorization?: string | string[] };
  }).headers;

  const cookieHeader = headers?.cookie;
  if (cookieHeader) {
    const cookies = parseCookieHeader(cookieHeader);
    if (cookies["sb-access-token"]) return cookies["sb-access-token"];
  }

  const authorization = headers?.authorization;
  const authHeader = Array.isArray(authorization) ? authorization[0] : authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  return null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const accessToken = getAccessToken(opts.req);
  let user: AppUser | null = null;

  if (accessToken) {
    try {
      const authUser = await getSupabaseUser(accessToken);
      if (authUser) user = (await upsertAppUser(authUser)) as AppUser;
    } catch (error) {
      console.warn("[Auth] Supabase session validation failed:", error);
    }
  }

  const cookies = parseCookieHeader(((opts.req as any).headers?.cookie ?? "") as string);
  const membership = Number(cookies["condohub-membership"]);
  return {
    req: opts.req,
    res: opts.res,
    user,
    activeMembershipId: Number.isInteger(membership) && membership > 0 ? membership : null,
  };
}
