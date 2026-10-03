import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    return;
  }

  try {
    const { getSupabaseAuth } = await import("../../server/supabase");
    const { data, error } = await getSupabaseAuth().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      res.status(401).json({ error: error?.message ?? "Não foi possível entrar." });
      return;
    }

    res.setHeader(
      "Set-Cookie",
      `sb-access-token=${data.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${data.session.expires_in}`,
    );
    res.status(200).json({ user: data.user, expiresIn: data.session.expires_in });
  } catch (error) {
    console.error("[Auth] Failed to initialize Supabase sign-in:", error);
    res.status(500).json({ error: "Falha ao inicializar autenticação." });
  }
}
