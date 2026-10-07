import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Set-Cookie", [
    "sb-access-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    "sb-refresh-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
  ]);
  res.status(200).json({ success: true });
}
