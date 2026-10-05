import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signUp } from "../_lib/supabase.js";

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

  try {
    const headers = req.headers ?? {};
    const forwardedProto = headers["x-forwarded-proto"];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto ?? "https";
    const host = headers.host;
    const safeInviteToken =
      typeof inviteToken === "string" && /^[A-Za-z0-9_-]{20,96}$/.test(inviteToken)
        ? inviteToken
        : null;
    const redirectTo = host
      ? `${protocol}://${host}/login${safeInviteToken ? `?invite=${encodeURIComponent(safeInviteToken)}` : ""}`
      : undefined;

    const { data, error } = await signUp(
      email,
      password,
      typeof name === "string" ? name : undefined,
      redirectTo,
    );

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (data.session) {
      res.setHeader(
        "Set-Cookie",
        `sb-access-token=${data.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${data.session.expires_in}`,
      );
    }

    res.status(201).json({ user: data.user, needsEmailConfirmation: !data.session });
  } catch (error) {
    console.error("[Auth] Failed to initialize Supabase sign-up:", error);
    res.status(500).json({ error: "Falha ao inicializar autenticação." });
  }
}
