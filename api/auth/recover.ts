import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendPasswordRecovery } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const { email, inviteToken } = req.body ?? {};
  if (typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Informe um e-mail válido." });
  }

  const headers = req.headers ?? {};
  const proto = Array.isArray(headers["x-forwarded-proto"]) ? headers["x-forwarded-proto"][0] : headers["x-forwarded-proto"] ?? "https";
  const host = headers.host;
  const safeInvite =
    typeof inviteToken === "string" && /^[A-Za-z0-9_-]{20,96}$/.test(inviteToken)
      ? inviteToken
      : null;
  const redirectTo = host
    ? `${proto}://${host}/reset-password${safeInvite ? `?invite=${encodeURIComponent(safeInvite)}` : ""}`
    : undefined;

  const result = await sendPasswordRecovery(email.trim().toLowerCase(), redirectTo);
  if (!result.ok) return res.status(400).json({ error: result.error });

  return res.json({ success: true });
}
