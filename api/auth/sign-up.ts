import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signUp, syncAppUser, validateInvitationForSignup } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const { email, password, name, inviteToken } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    return;
  }
  if (typeof inviteToken !== "string" || !/^[A-Za-z0-9_-]{20,96}$/.test(inviteToken)) {
    res.status(403).json({ error: "Novos acessos só podem ser criados por um convite válido." });
    return;
  }

  try {
    const headers = req.headers ?? {};
    const forwardedProto = headers["x-forwarded-proto"];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto ?? "https";
    const host = headers.host;
    const safeInviteToken = inviteToken;
    const normalizedEmail = email.trim().toLowerCase();
    const invitation = await validateInvitationForSignup(safeInviteToken, normalizedEmail);
    if (!invitation.ok) {
      res.status(403).json({ error: invitation.error });
      return;
    }

    const configuredBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
    const origin = configuredBaseUrl || (host ? `${protocol}://${host}` : undefined);
    const redirectTo = origin
      ? `${origin}/auth/callback?invite=${encodeURIComponent(safeInviteToken)}`
      : undefined;

    const { data, error } = await signUp(
      normalizedEmail,
      password,
      typeof name === "string" ? name : undefined,
      redirectTo,
    );

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.setHeader("Cache-Control", "private, no-store");
    if (data.session) {
      res.setHeader("Set-Cookie", [
        `sb-access-token=${data.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${data.session.expires_in}`,
        `sb-refresh-token=${data.session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
      ]);
      if (data.user) await syncAppUser(data.user);
    }

    res.status(201).json({ user: data.user, needsEmailConfirmation: !data.session });
  } catch (error) {
    console.error("[Auth] Failed to initialize Supabase sign-up:", error);
    res.status(500).json({ error: "Falha ao inicializar autenticação." });
  }
}
