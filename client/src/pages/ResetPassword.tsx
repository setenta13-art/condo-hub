import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

export default function ResetPassword() {
  const accessToken = useMemo(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return hash.get("access_token");
  }, []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const invite = useMemo(
    () =>
      new URLSearchParams(window.location.search).get("invite") ??
      localStorage.getItem("condohub-pending-invite") ??
      sessionStorage.getItem("condohub-pending-invite"),
    [],
  );

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const refreshToken = hash.get("refresh_token");
    const expiresIn = Number(hash.get("expires_in") ?? 3600);
    if (!accessToken || !refreshToken) return;
    void fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accessToken, refreshToken, expiresIn }),
    });
    if (invite) {
      localStorage.setItem("condohub-pending-invite", invite);
      sessionStorage.setItem("condohub-pending-invite", invite);
    }
  }, [accessToken, invite]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      setMessage("Este link de recuperação é inválido ou expirou.");
      return;
    }
    if (password.length < 6) {
      setMessage("Use uma senha com pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    setMessage("");
    const response = await fetch("/api/auth/update-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken, password }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage(result.error ?? "Não foi possível atualizar a senha.");
      return;
    }

    setSuccess(true);
    setMessage("Senha atualizada com sucesso.");
    history.replaceState(null, "", "/reset-password");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-9">
        <Link href="/login" className="text-sm font-semibold text-primary">← Voltar para o login</Link>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">Redefinir senha</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Crie uma nova senha para sua conta do CondoHub.</p>

        {!success ? (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" type="password" minLength={6} value={password} onChange={event => setPassword(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmation">Confirmar nova senha</Label>
              <Input id="confirmation" type="password" minLength={6} value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
            </div>
            {message && <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p>}
            <Button type="submit" disabled={busy || !accessToken} className="w-full rounded-xl">
              {busy ? "Atualizando..." : "Atualizar senha"}
            </Button>
          </form>
        ) : (
          <div className="mt-7">
            <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">{message}</p>
            <Button
              className="mt-4 w-full rounded-xl"
              onClick={() => { window.location.href = invite ? `/invite/${invite}` : "/"; }}
            >
              Continuar no CondoHub
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
