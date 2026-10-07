import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signIn, syncAppUser } from "../_lib/supabase.js";

function sessionCookies(session: { access_token: string; refresh_token?: string; expires_in: number }) {
  const cookies = [
    `sb-access-token=${session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${session.expires_in}`,
  ];
  if (session.refresh_token) {
    cookies.push(`sb-refresh-token=${session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
  }
  return cookies;
}

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
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await signIn(normalizedEmail, password);
    if (error || !data.session || !data.user) {
      res.status(401).json({ error: error?.message ?? "Não foi possível entrar." });
      return;
    }

    await syncAppUser(data.user);

    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Set-Cookie", sessionCookies(data.session));
    res.status(200).json({ user: data.user, expiresIn: data.session.expires_in });
  } catch (error) {
    console.error("[Auth] Failed to initialize Supabase sign-in:", error);
    res.status(500).json({ error: "Falha ao inicializar autenticação." });
  }
}
