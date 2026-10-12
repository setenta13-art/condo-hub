import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./supabase.js", () => ({ supabaseAdminFetch: vi.fn() }));
import { supabaseAdminFetch } from "./supabase.js";
import { getUserScope } from "./db.js";
beforeEach(() => {
  vi.mocked(supabaseAdminFetch)
    .mockReset()
    .mockImplementation(async path => {
      let rows: unknown[] = [];
      if (path.startsWith("memberships?"))
        rows = [
          { id: 11, user_id: 1, condominium_id: 10, role: "resident" },
          { id: 12, user_id: 1, condominium_id: 20, role: "staff" },
        ];
      else if (path.startsWith("condominiums?id=eq.10"))
        rows = [{ id: 10, organization_id: 100, name: "A" }];
      else if (path.startsWith("condominiums?id=eq.20"))
        rows = [{ id: 20, organization_id: 200, name: "B" }];
      else if (path.startsWith("organizations?"))
        rows = [{ id: path.includes("200") ? 200 : 100, name: "Organization" }];
      return new Response(JSON.stringify(rows));
    });
});
afterEach(() => vi.restoreAllMocks());
describe("actual context resolution", () => {
  it("selects the requested owned membership, keeping its role and condominium", async () => {
    expect(await getUserScope(1, false, 12)).toMatchObject({
      membership: { id: 12, role: "staff" },
      condominium: { id: 20 },
      organization: { id: 200 },
    });
  });
  it("fails closed for a forged or revoked membership cookie instead of falling back", async () => {
    expect(await getUserScope(1, false, 99)).toBeUndefined();
  });
  it("uses the first owned context only when no preference is supplied", async () => {
    expect(await getUserScope(1, false)).toMatchObject({
      membership: { id: 11 },
    });
  });
});
