import { describe, expect, it } from "vitest";
import { appRouter } from "./routers.js";
import type { TrpcContext } from "./_core/context.js";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.logout compatibility procedure", () => {
  it("reports success without owning cookie state", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auth.logout()).resolves.toEqual({ success: true });
  });
});
