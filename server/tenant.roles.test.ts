import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./db.js", async importOriginal => ({
  ...(await importOriginal<typeof import("./db.js")>()),
  getUserScope: vi.fn(),
  listUserScopes: vi.fn(),
  listMemberships: vi.fn(),
  getUserById: vi.fn(),
  getTicketById: vi.fn(),
  listBlocks: vi.fn(),
  listUnits: vi.fn(),
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  updateMembership: vi.fn(),
  removeMembership: vi.fn(),
}));
import * as db from "./db.js";
import { appRouter } from "./routers.js";
import type { TrpcContext } from "./_core/context.js";
const membership = {
  id: 1,
  userId: 1,
  condominiumId: 10,
  role: "resident",
  unit: "101",
  block: "A",
};
function context(role = "user"): TrpcContext {
  return {
    user: { id: 1, role, email: "a@example.com" } as TrpcContext["user"],
    activeMembershipId: 1,
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {
      setHeader: vi.fn(),
      getHeader: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}
function scope(role = "resident") {
  return {
    membership: { ...membership, role },
    condominium: { id: 10, name: "Condo A" },
    organization: { id: 100 },
  } as Awaited<ReturnType<typeof db.getUserScope>>;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getUserScope).mockResolvedValue(scope());
  vi.mocked(db.listUserScopes).mockResolvedValue([scope()!] as Awaited<
    ReturnType<typeof db.listUserScopes>
  >);
});
describe("tenant and role boundaries", () => {
  it("rejects selecting another user's membership", async () => {
    await expect(
      appRouter.createCaller(context()).auth.switchContext({ membershipId: 99 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("does not expose names/emails/unit directory in resident ticket options", async () => {
    expect(
      await appRouter.createCaller(context()).condo.tickets.options()
    ).toEqual({ isStaff: false, responsibles: [], blocks: [], units: [] });
    expect(db.getUserById).not.toHaveBeenCalled();
  });
  it("rejects ticket IDs outside the active condominium", async () => {
    vi.mocked(db.getTicketById).mockResolvedValue(undefined);
    await expect(
      appRouter.createCaller(context()).condo.tickets.detail({ id: 999 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.getTicketById).toHaveBeenCalledWith(999, 10);
  });
  it("rejects another unit's ticket even inside the same condominium", async () => {
    vi.mocked(db.getTicketById).mockResolvedValue({
      id: 7,
      openedById: 2,
      unit: "202",
      block: "A",
    } as Awaited<ReturnType<typeof db.getTicketById>>);
    await expect(
      appRouter.createCaller(context()).condo.tickets.detail({ id: 7 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each(["staff", "resident"])(
    "%s cannot edit or remove managers",
    async role => {
      vi.mocked(db.getUserScope).mockResolvedValue(scope(role));
      const caller = appRouter.createCaller(context());
      await expect(
        caller.responsibles.update({ id: 2, role: "manager" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.responsibles.remove({ id: 2 })).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
      expect(db.updateMembership).not.toHaveBeenCalled();
      expect(db.removeMembership).not.toHaveBeenCalled();
    }
  );
  it("staff cannot issue manager invitations", async () => {
    vi.mocked(db.getUserScope).mockResolvedValue(scope("staff"));
    await expect(
      appRouter
        .createCaller(context())
        .invitations.create({ email: "b@example.com", role: "manager" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createInvitation).not.toHaveBeenCalled();
  });
  it("manager cannot downgrade the global administrator", async () => {
    vi.mocked(db.getUserScope).mockResolvedValue(scope("manager"));
    vi.mocked(db.listMemberships).mockResolvedValue([
      { ...membership, id: 2, userId: 2, role: "manager" },
    ] as Awaited<ReturnType<typeof db.listMemberships>>);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2,
      role: "admin",
    } as Awaited<ReturnType<typeof db.getUserById>>);
    await expect(
      appRouter
        .createCaller(context())
        .responsibles.update({ id: 2, role: "staff" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("even platform administration cannot remove the global administrator membership", async () => {
    vi.mocked(db.getUserScope).mockResolvedValue(scope("manager"));
    vi.mocked(db.listMemberships).mockResolvedValue([
      { ...membership, id: 2, userId: 2 },
    ] as Awaited<ReturnType<typeof db.listMemberships>>);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 2,
      role: "admin",
    } as Awaited<ReturnType<typeof db.getUserById>>);
    await expect(
      appRouter.createCaller(context("admin")).responsibles.remove({ id: 2 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
