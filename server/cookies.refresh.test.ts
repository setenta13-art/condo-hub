import { describe, expect, it, vi } from "vitest";
import { appendResponseCookie } from "./_core/cookies.js";
describe("membership selection after refresh", () => {
  it("keeps access and refresh cookies when selecting a context", () => {
    const res = {
      getHeader: () => ["sb-access-token=new", "sb-refresh-token=new"],
      setHeader: vi.fn(),
    };
    appendResponseCookie(res, "condohub-membership=7");
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", [
      "sb-access-token=new",
      "sb-refresh-token=new",
      "condohub-membership=7",
    ]);
  });
});
