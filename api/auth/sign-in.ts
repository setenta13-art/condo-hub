import type { VercelRequest, VercelResponse } from "@vercel/node";
import { activateInvitationForAuthenticatedUser, signIn, syncAppUser } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const { email, password, inviteToken } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    return;
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await signIn(normalizedEmail, password);
    if (error || !data.session) {
      res.status(401).json({ error: error?.message ?? "Não foi possível entrar." });
      return;
    }

    let inviteAccepted = false;
    let inviteActivationError: string | null = null;
    let membershipId: number | null = null;

    if (data.user) {
      const appUser = await syncAppUser(data.user);
      const activation = await activateInvitationForAuthenticatedUser(
        typeof inviteToken === "string" ? inviteToken : null,
        appUser.id,
        data.user.email,
      );
      inviteAccepted = Boolean(activation.ok);
      if (activation.ok && activation.membershipId != null) {
        const parsedMembershipId = Number(activation.membershipId);
        membershipId = Number.isInteger(parsedMembershipId) && parsedMembershipId > 0 ? parsedMembershipId : null;
      } else if (!activation.ok && activation.attempted) {
        inviteActivationError = activation.message ?? "Não foi possível ativar o convite.";
      }
    }

    res.setHeader("Cache-Control", "private, no-store");
    const cookies = [
      `sb-access-token=${data.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${data.session.expires_in}`,
      `sb-refresh-token=${data.session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
    ];
    if (membershipId) {
      cookies.push(`condohub-membership=${membershipId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`);
    }
    res.setHeader("Set-Cookie", cookies);
    res.status(200).json({
      user: data.user,
      expiresIn: data.session.expires_in,
      inviteAccepted,
      inviteActivationError,
      membershipId,
    });
  } catch (error) {
    console.error("[Auth] Failed to initialize Supabase sign-in:", error);
    res.status(500).json({ error: "Falha ao inicializar autenticação." });
  }
}
