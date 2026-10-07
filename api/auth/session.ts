import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUser, syncAppUser } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const { accessToken, refreshToken, expiresIn } = req.body ?? {};
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    return res.status(400).json({ error: "Sessão inválida." });
  }

  const authUser = await getUser(accessToken);
  if (!authUser) return res.status(401).json({ error: "Sessão inválida ou expirada." });

  await syncAppUser(authUser);
  const maxAge = Number.isFinite(Number(expiresIn)) ? Math.max(60, Number(expiresIn)) : 3600;
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Set-Cookie", [
    `sb-access-token=${accessToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
    `sb-refresh-token=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
  ]);
  return res.json({ success: true });
}
