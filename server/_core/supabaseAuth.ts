import type { Express, Request, Response } from "express";
import { signInWithPassword, signUpWithPassword } from "../supabase";

const COOKIE = "sb-access-token";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function registerSupabaseAuthRoutes(app: Express) {
  app.post("/api/auth/sign-in", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      return;
    }

    const { data, error } = await signInWithPassword(email, password);
    if (error || !data.session) {
      res.status(401).json({ error: error?.message ?? "Não foi possível entrar." });
      return;
    }

    res.cookie(COOKIE, data.session.access_token, {
      ...cookieOptions,
      maxAge: data.session.expires_in * 1000,
    });
    res.json({ user: data.user, expiresIn: data.session.expires_in });
  });

  app.post("/api/auth/sign-up", async (req: Request, res: Response) => {
    const { email, password, name } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      return;
    }

    const { data, error } = await signUpWithPassword(
      email,
      password,
      typeof name === "string" ? name : undefined,
    );
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (data.session) {
      res.cookie(COOKIE, data.session.access_token, {
        ...cookieOptions,
        maxAge: data.session.expires_in * 1000,
      });
    }
    res.status(201).json({
      user: data.user,
      needsEmailConfirmation: !data.session,
    });
  });

  app.post("/api/auth/sign-out", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE, cookieOptions);
    res.json({ success: true });
  });
}
