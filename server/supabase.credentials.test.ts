import { describe, expect, it } from "vitest";

describe("Supabase credentials", () => {
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

  it.skipIf(!configured)("can reach the Auth settings endpoint with the configured public key", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    expect(url, "SUPABASE_URL must be configured").toMatch(/^https:\/\/[^/]+\.supabase\.co\/?$/);
    expect(key, "SUPABASE_ANON_KEY must be configured").toBeTruthy();

    const response = await fetch(`${url!.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key!, Authorization: `Bearer ${key!}` },
    });

    expect(response.ok, `Supabase Auth responded with HTTP ${response.status}`).toBe(true);
  });
});
