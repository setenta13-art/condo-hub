import type { VercelRequest, VercelResponse } from "@vercel/node";
import { acceptInvitationForUser, getUser, syncAppUser } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const { accessToken, refreshToken, expiresIn, inviteToken } = req.body ?? {};
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    return res.status(400).json({ error: "Sessão inválida." });
  }

  const authUser = await getUser(accessToken);
  if (!authUser) return res.status(401).json({ error: "Sessão inválida ou expirada." });

  const appUser = await syncAppUser(authUser);
  let inviteAccepted = false;
  let inviteActivationError: string | null = null;
  let membershipId: number | null = null;

  if (typeof inviteToken === "string" && /^[A-Za-z0-9_-]{20,96}$/.test(inviteToken)) {
    const activation = await acceptInvitationForUser(inviteToken, appUser.id, authUser.email);
    inviteAccepted = Boolean(activation.ok);
    if (activation.ok && activation.membershipId != null) {
      const parsedMembershipId = Number(activation.membershipId);
      membershipId = Number.isInteger(parsedMembershipId) && parsedMembershipId > 0 ? parsedMembershipId : null;
    } else if (!activation.ok) {
      inviteActivationError = activation.message ?? "Não foi possível ativar o convite.";
    }
  }

  const maxAge = Number.isFinite(Number(expiresIn)) ? Math.max(60, Number(expiresIn)) : 3600;
  res.setHeader("Cache-Control", "private, no-store");
  const cookies = [
    `sb-access-token=${accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
    `sb-refresh-token=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
  ];
  if (membershipId) {
    cookies.push(`condohub-membership=${membershipId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`);
  }
  res.setHeader("Set-Cookie", cookies);
  return res.json({ success: true, inviteAccepted, inviteActivationError, membershipId });
}
