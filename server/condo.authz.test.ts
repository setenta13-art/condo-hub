import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("condo authorization", () => {
  it("requires authentication to read the dashboard overview", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());

    await expect(caller.condo.dashboard.overview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication before opening a ticket", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());

    await expect(
      caller.condo.tickets.create({
        title: "Solicitação de teste",
        description: "Detalhes da solicitação de teste",
        category: "maintenance",
        priority: "medium",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
