import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

vi.mock("../_lib/supabase.js", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  syncAppUser: vi.fn(),
  validateInvitationForSignup: vi.fn(),
}));

import { signIn, signUp, validateInvitationForSignup } from "../_lib/supabase.js";
import signInHandler from "./sign-in.js";
import signOutHandler from "./sign-out.js";
import signUpHandler from "./sign-up.js";

function createResponse() {
  const headers = new Map<string, string | string[]>();
  let statusCode = 200;
  let body: unknown;

  const res = {
    setHeader(name: string, value: string | string[]) {
      headers.set(name.toLowerCase(), value);
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(value: unknown) {
      body = value;
      return res;
    },
  } as unknown as VercelResponse;

  return {
    res,
    headers,
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

describe("serverless Supabase auth handlers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sets a secure HttpOnly access-token cookie after sign-in", async () => {
    vi.mocked(signIn).mockResolvedValue({
      data: {
        user: { id: "user-1", email: "user@example.com" },
        session: { access_token: "token-value", refresh_token: "refresh-value", expires_in: 3600 },
      },
      error: null,
    });

    const req = {
      method: "POST",
      body: { email: "user@example.com", password: "password123" },
    } as unknown as VercelRequest;
    const response = createResponse();

    await signInHandler(req, response.res);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ expiresIn: 3600 });
    expect(response.headers.get("set-cookie")).toEqual(
      expect.arrayContaining([
        "sb-access-token=token-value; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600",
        "sb-refresh-token=refresh-value; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000",
      ]),
    );
  });

  it("returns 401 and no cookie for invalid sign-in", async () => {
    vi.mocked(signIn).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const req = {
      method: "POST",
      body: { email: "user@example.com", password: "wrong-password" },
    } as unknown as VercelRequest;
    const response = createResponse();

    await signInHandler(req, response.res);

    expect(response.statusCode).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("reports email confirmation when invited sign-up returns no session", async () => {
    vi.mocked(validateInvitationForSignup).mockResolvedValue({ ok: true } as const);
    vi.mocked(signUp).mockResolvedValue({
      data: {
        user: { id: "user-2", email: "new@example.com" },
        session: null,
      },
      error: null,
    });

    const req = {
      method: "POST",
      headers: { host: "example.com", "x-forwarded-proto": "https" },
      body: { email: "new@example.com", password: "password123", name: "New User", inviteToken: "abcdefghijklmnopqrstuvwxyz123456" },
    } as unknown as VercelRequest;
    const response = createResponse();

    await signUpHandler(req, response.res);

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({ needsEmailConfirmation: true });
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("rejects sign-up when no invitation is supplied", async () => {
    const req = {
      method: "POST",
      body: { email: "new@example.com", password: "password123", name: "New User" },
    } as unknown as VercelRequest;
    const response = createResponse();

    await signUpHandler(req, response.res);

    expect(response.statusCode).toBe(403);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("expires auth and context cookies on sign-out", () => {
    const req = { method: "POST" } as unknown as VercelRequest;
    const response = createResponse();

    signOutHandler(req, response.res);

    expect(response.statusCode).toBe(200);
    const cookies = response.headers.get("set-cookie");
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringContaining("sb-access-token="),
      expect.stringContaining("sb-refresh-token="),
      expect.stringContaining("condohub-membership="),
    ]));
    expect((cookies as string[]).every(cookie => cookie.includes("Max-Age=0"))).toBe(true);
  });
});
