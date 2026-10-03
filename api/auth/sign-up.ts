import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAuth } from "../../server/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }
  const { email, password, name } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    return;
  }
  const { data, error } = await getSupabaseAuth().auth.signUp({
    email,
    password,
    options: { data: { name: typeof name === "string" ? name : undefined } },
  });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (data.session) {
    res.setHeader("Set-Cookie", `sb-access-token=${data.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${data.session.expires_in}`);
  }
  res.status(201).json({ user: data.user, needsEmailConfirmation: !data.session });
}
