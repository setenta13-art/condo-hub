import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function AuthCallback() {
  const [message, setMessage] = useState("Confirmando seu acesso...");

  useEffect(() => {
    void (async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const expiresIn = Number(hash.get("expires_in") ?? 3600);
      const invite =
        new URLSearchParams(window.location.search).get("invite") ??
        localStorage.getItem("condohub-pending-invite") ??
        sessionStorage.getItem("condohub-pending-invite");

      if (invite) {
        localStorage.setItem("condohub-pending-invite", invite);
        sessionStorage.setItem("condohub-pending-invite", invite);
      }

      if (!accessToken || !refreshToken) {
        setMessage("Não foi possível confirmar esta sessão. Abra novamente o link recebido ou entre com sua senha.");
        return;
      }

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessToken, refreshToken, expiresIn }),
      });
      if (!response.ok) {
        setMessage("Este link é inválido ou expirou. Solicite um novo convite.");
        return;
      }

      history.replaceState(null, "", "/auth/callback");
      window.location.href = invite ? `/invite/${invite}` : "/";
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-semibold text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
