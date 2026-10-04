import { describe, expect, it } from "vitest";

describe("Supabase credentials", () => {
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

  it.skipIf(!configured)("can reach the Auth settings endpoint with the configured public key", async () => {
    const rawUrl = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_ANON_KEY!;

    const parsed = new URL(rawUrl);
    expect(parsed.protocol).toBe("https:");
    expect(parsed.hostname).toMatch(/\.supabase\.co$/);
    expect(key).toBeTruthy();

    const response = await fetch(`${parsed.origin}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    expect(response.ok, `Supabase Auth responded with HTTP ${response.status}`).toBe(true);
  });
});
