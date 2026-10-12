import { CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function AuthCallback() {
  const [failed, setFailed] = useState(false);
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
        setFailed(true);
        history.replaceState(null, "", "/auth/callback");
        setMessage(
          "Não foi possível confirmar esta sessão. Abra novamente o link recebido ou entre com sua senha."
        );
        return;
      }

      try {
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            accessToken,
            refreshToken,
            expiresIn,
            inviteToken: invite,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          setFailed(true);
          history.replaceState(null, "", "/auth/callback");
          setMessage(
            "Este link é inválido ou expirou. Solicite um novo convite."
          );
          return;
        }

        history.replaceState(null, "", "/auth/callback");
        if (result.inviteAccepted) {
          localStorage.removeItem("condohub-pending-invite");
          sessionStorage.removeItem("condohub-pending-invite");
          window.location.href = "/";
          return;
        }
        window.location.href = invite
          ? `/invite/${encodeURIComponent(invite)}`
          : "/";
      } catch {
        setFailed(true);
        history.replaceState(null, "", "/auth/callback");
        setMessage(
          "Não foi possível concluir a confirmação agora. Volte ao login e tente novamente. Se o problema persistir, solicite outro convite."
        );
      }
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        {failed ? (
          <CircleAlert className="mx-auto h-8 w-8 text-destructive" />
        ) : (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        )}
        <p
          role="status"
          className="mt-4 text-sm font-semibold text-muted-foreground"
        >
          {message}
        </p>
        {failed && (
          <a
            href="/login"
            className="mt-5 inline-flex font-semibold text-primary underline"
          >
            Voltar ao login
          </a>
        )}
      </div>
    </main>
  );
}
