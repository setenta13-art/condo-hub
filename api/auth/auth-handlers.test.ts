import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

vi.mock("../_lib/supabase.js", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

import { signIn, signUp } from "../_lib/supabase.js";
import signInHandler from "./sign-in.js";
import signOutHandler from "./sign-out.js";
import signUpHandler from "./sign-up.js";

function createResponse() {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let body: unknown;

  const res = {
    setHeader(name: string, value: string) {
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
        session: { access_token: "token-value", expires_in: 3600 },
      },
      error: null,
    });

    const req = {
      method: "POST",
      body: { email: "user@example.com", password: "password123" },
    } as VercelRequest;
    const response = createResponse();

    await signInHandler(req, response.res);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ expiresIn: 3600 });
    expect(response.headers.get("set-cookie")).toBe(
      "sb-access-token=token-value; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600",
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
    } as VercelRequest;
    const response = createResponse();

    await signInHandler(req, response.res);

    expect(response.statusCode).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("reports email confirmation when sign-up returns no session", async () => {
    vi.mocked(signUp).mockResolvedValue({
      data: {
        user: { id: "user-2", email: "new@example.com" },
        session: null,
      },
      error: null,
    });

    const req = {
      method: "POST",
      body: { email: "new@example.com", password: "password123", name: "New User" },
    } as VercelRequest;
    const response = createResponse();

    await signUpHandler(req, response.res);

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({ needsEmailConfirmation: true });
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("expires the access-token cookie on sign-out", () => {
    const req = { method: "POST" } as VercelRequest;
    const response = createResponse();

    signOutHandler(req, response.res);

    expect(response.statusCode).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("sb-access-token=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
