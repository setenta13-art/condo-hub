import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function unauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("invitations authorization", () => {
  it("protects the invitation administration list", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());

    await expect(caller.invitations.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("protects accepting an invitation until the user is authenticated", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());

    await expect(caller.invitations.accept({ token: "a".repeat(20) })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects malformed public invite tokens", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());

    await expect(caller.invitations.preview({ token: "short" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
