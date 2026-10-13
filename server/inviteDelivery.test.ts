import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendInviteEmail } from "./_core/inviteDelivery";

const input = {
  to: "test@example.com",
  condominiumName: 'Condomínio <script>"&',
  inviteUrl: "https://example.com/invite?token=synthetic&source=test",
  expiresAt: new Date("2026-10-20T12:00:00Z"),
};

describe("invitation email delivery", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("INVITE_FROM_EMAIL", "");
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not send without both sender and provider credentials", async () => {
    expect(await sendInviteEmail(input)).toEqual({ status: "not_configured" });
    vi.stubEnv("BREVO_API_KEY", "synthetic-brevo-key");
    expect(await sendInviteEmail(input)).toEqual({ status: "not_configured" });
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("INVITE_FROM_EMAIL", "sender@example.com");
    expect(await sendInviteEmail(input)).toEqual({ status: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends through Brevo with escaped HTML, intact text and a bounded request", async () => {
    vi.stubEnv("BREVO_API_KEY", "synthetic-brevo-key");
    vi.stubEnv("RESEND_API_KEY", "synthetic-resend-key");
    vi.stubEnv("INVITE_FROM_EMAIL", "sender@example.com");
    fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));
    expect(await sendInviteEmail(input)).toEqual({ status: "sent" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(options.headers["api-key"]).toBe("synthetic-brevo-key");
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body);
    expect(body.sender).toEqual({
      email: "sender@example.com",
      name: "CondoHub",
    });
    expect(body.to).toEqual([{ email: input.to }]);
    expect(body.textContent).toContain(input.inviteUrl);
    expect(body.htmlContent).not.toContain("<script>");
    expect(body.htmlContent).toContain("&lt;script&gt;&quot;&amp;");
    expect(body.htmlContent).toContain(
      'href="https://example.com/invite?token=synthetic&amp;source=test"'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("converts a display-name sender for Brevo", async () => {
    vi.stubEnv("BREVO_API_KEY", "synthetic-brevo-key");
    vi.stubEnv("INVITE_FROM_EMAIL", "CondoHub Test <sender@example.com>");
    fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));
    await sendInviteEmail(input);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sender).toEqual({
      email: "sender@example.com",
      name: "CondoHub Test",
    });
  });

  it("keeps existing Resend delivery when Brevo is absent", async () => {
    vi.stubEnv("RESEND_API_KEY", "synthetic-resend-key");
    vi.stubEnv("INVITE_FROM_EMAIL", "CondoHub <sender@example.com>");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await sendInviteEmail(input)).toEqual({ status: "sent" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers.Authorization).toBe("Bearer synthetic-resend-key");
    const body = JSON.parse(options.body);
    expect(body.from).toBe("CondoHub <sender@example.com>");
    expect(body.to).toEqual([input.to]);
    expect(body.text).toContain(input.inviteUrl);
  });

  it.each([401, 429, 500])(
    "does not fail over or leak provider contents on HTTP %s",
    async status => {
      vi.stubEnv("BREVO_API_KEY", "synthetic-brevo-key");
      vi.stubEnv("RESEND_API_KEY", "synthetic-resend-key");
      vi.stubEnv("INVITE_FROM_EMAIL", "sender@example.com");
      const logger = vi.spyOn(console, "error").mockImplementation(() => {});
      fetchMock.mockResolvedValue(
        new Response("sensitive provider response", { status })
      );
      expect(await sendInviteEmail(input)).toEqual({ status: "failed" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith(
        "[Invites] Brevo delivery failed:",
        status
      );
    }
  );

  it("returns a recoverable failure after a network error without resending", async () => {
    vi.stubEnv("BREVO_API_KEY", "synthetic-brevo-key");
    vi.stubEnv("RESEND_API_KEY", "synthetic-resend-key");
    vi.stubEnv("INVITE_FROM_EMAIL", "sender@example.com");
    fetchMock.mockRejectedValue(new Error("synthetic network failure"));
    expect(await sendInviteEmail(input)).toEqual({ status: "failed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
