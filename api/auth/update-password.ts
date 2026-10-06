import type { VercelRequest, VercelResponse } from "@vercel/node";
import { updatePassword } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const { accessToken, password } = req.body ?? {};
  if (typeof accessToken !== "string" || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Link inválido ou senha muito curta." });
  }

  const result = await updatePassword(accessToken, password);
  if (!result.ok) return res.status(400).json({ error: result.error });

  return res.json({ success: true });
}
