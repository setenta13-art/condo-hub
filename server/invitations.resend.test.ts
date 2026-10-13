import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./db.js", async importOriginal => ({
  ...(await importOriginal<typeof import("./db.js")>()),
  getUserScope: vi.fn(),
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));
vi.mock("./_core/inviteDelivery.js", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/inviteDelivery.js")>()),
  sendInviteEmail: vi.fn(),
}));
import * as db from "./db.js";
import { sendInviteEmail } from "./_core/inviteDelivery.js";
import { appRouter } from "./routers.js";
import type { TrpcContext } from "./_core/context.js";
const invitation = {
  id: 7,
  condominiumId: 10,
  token: "synthetic-token-existing",
  email: "test@example.com",
  phone: null,
  role: "resident",
  status: "pending",
  unit: "101",
  block: "A",
  expiresAt: new Date("2099-01-01T12:00:00Z"),
};
const ctx = {
  user: { id: 1, role: "user" },
  activeMembershipId: 1,
  req: { headers: { host: "test.example.com" } },
  res: {},
} as TrpcContext;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getUserScope).mockResolvedValue({
    membership: { id: 1, role: "manager" },
    condominium: { id: 10, name: "Condo A" },
  } as Awaited<ReturnType<typeof db.getUserScope>>);
  vi.mocked(db.listInvitations).mockResolvedValue([invitation] as Awaited<
    ReturnType<typeof db.listInvitations>
  >);
});
describe("safe invitation resend", () => {
  it.each(["sent", "failed", "not_configured"] as const)(
    "keeps the original link and records no changes after %s",
    async status => {
      vi.mocked(sendInviteEmail).mockResolvedValue({ status });
      const result = await appRouter
        .createCaller(ctx)
        .invitations.resend({ id: 7 });
      expect(result).toMatchObject({
        id: 7,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
        emailDelivery: status,
      });
      expect(sendInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: invitation.email,
          expiresAt: invitation.expiresAt,
          inviteUrl: expect.stringContaining(`/invite/${invitation.token}`),
        })
      );
      expect(db.createInvitation).not.toHaveBeenCalled();
      expect(db.revokeInvitation).not.toHaveBeenCalled();
    }
  );
  it("rejects invitations outside the active condominium without sending", async () => {
    vi.mocked(db.listInvitations).mockResolvedValue([]);
    await expect(
      appRouter.createCaller(ctx).invitations.resend({ id: 999 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.listInvitations).toHaveBeenCalledWith(10);
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });
  it("rejects expired pending invitations without renewal or delivery", async () => {
    vi.mocked(db.listInvitations).mockResolvedValue([
      { ...invitation, expiresAt: new Date(0) },
    ] as Awaited<ReturnType<typeof db.listInvitations>>);
    await expect(
      appRouter.createCaller(ctx).invitations.resend({ id: 7 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(sendInviteEmail).not.toHaveBeenCalled();
    expect(db.createInvitation).not.toHaveBeenCalled();
    expect(db.revokeInvitation).not.toHaveBeenCalled();
  });
});
