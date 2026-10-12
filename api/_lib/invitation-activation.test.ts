import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateInvitationForAuthenticatedUser } from "./supabase.js";
const token = "t".repeat(32);
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const response = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });
describe("explicit invitation activation", () => {
  it("reports recoverable activation failure while allowing the login to complete", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network unavailable"));
    expect(
      await activateInvitationForAuthenticatedUser(token, 1, "test@example.com")
    ).toMatchObject({ ok: false, code: "RPC_ERROR", attempted: true });
  });
  it.each([
    "EMAIL_MISMATCH",
    "EXPIRED",
    "UNAVAILABLE",
    "NOT_FOUND",
    "RPC_ERROR",
  ])("never switches invitation on %s", async code => {
    fetchMock.mockResolvedValueOnce(response({ ok: false, code }));
    expect(
      await activateInvitationForAuthenticatedUser(token, 1, "test@example.com")
    ).toMatchObject({ ok: false, code, source: "token", attempted: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed explicit tokens without falling back to email", async () => {
    expect(
      await activateInvitationForAuthenticatedUser("bad", 1, "test@example.com")
    ).toMatchObject({ code: "INVALID_TOKEN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses equality and filters expiry before limiting email candidates", async () => {
    fetchMock.mockResolvedValueOnce(
      response([{ token, expires_at: "2099-01-01" }])
    );
    fetchMock.mockResolvedValueOnce(response({ ok: true, membershipId: 9 }));
    expect(
      await activateInvitationForAuthenticatedUser(null, 1, "TEST@example.com")
    ).toMatchObject({ ok: true, source: "email" });
    expect(fetchMock.mock.calls[0][0]).toContain(
      "email=eq.test%40example.com&expires_at=gt."
    );
  });
  it("requires a choice when multiple active invitations exist", async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        { token, expires_at: "2099-01-01" },
        { token: "x".repeat(32), expires_at: "2099-01-01" },
      ])
    );
    expect(
      await activateInvitationForAuthenticatedUser(null, 1, "test@example.com")
    ).toMatchObject({ code: "MULTIPLE_PENDING_INVITES", attempted: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
