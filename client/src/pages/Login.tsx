import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const pendingInvite =
    new URLSearchParams(window.location.search).get("invite") ??
    localStorage.getItem("condohub-pending-invite") ??
    sessionStorage.getItem("condohub-pending-invite");

  useEffect(() => {
    const inviteFromUrl = new URLSearchParams(window.location.search).get("invite");
    if (inviteFromUrl) {
      localStorage.setItem("condohub-pending-invite", inviteFromUrl);
      sessionStorage.setItem("condohub-pending-invite", inviteFromUrl);
    }
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const endpoint = mode === "login" ? "/api/auth/sign-in" : "/api/auth/sign-up";
    if (mode === "signup" && !pendingInvite) {
      setBusy(false);
      setMessage("Novos acessos só podem ser criados por um convite válido.");
      return;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, name, inviteToken: pendingInvite }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      const rawError = String(result.error ?? "");
      const friendlyError =
        rawError.toLowerCase().includes("invalid login credentials")
          ? "E-mail ou senha inválidos. Se você acabou de confirmar o cadastro, confira a senha digitada ou use “Esqueci minha senha”."
          : rawError || "Não foi possível concluir a operação.";
      setMessage(friendlyError);
      return;
    }
    if (result.needsEmailConfirmation) {
      setMessage("Cadastro criado. Confirme seu e-mail antes de entrar.");
      return;
    }
    if (pendingInvite) {
      navigate(`/invite/${pendingInvite}`);
    } else {
      navigate("/");
    }
    window.location.reload();
  }

  async function recoverPassword() {
    if (!email.trim()) {
      setMessage("Informe seu e-mail para receber o link de recuperação.");
      return;
    }

    setRecovering(true);
    setMessage("");
    const response = await fetch("/api/auth/recover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), inviteToken: pendingInvite }),
    });
    const result = await response.json().catch(() => ({}));
    setRecovering(false);

    if (!response.ok) {
      setMessage(result.error ?? "Não foi possível enviar a recuperação.");
      return;
    }

    setMessage("Enviamos um link para redefinir sua senha. Ao concluir, seu acesso continuará do ponto em que parou.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-9">
        <Link href="/" className="text-sm font-semibold text-primary">← Voltar para o CondoHub</Link>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">{mode === "login" ? "Entrar na sua conta" : "Criar acesso"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Use o e-mail autorizado pela administração do seu condomínio.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === "signup" && <div className="space-y-2"><Label htmlFor="name">Nome</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} required /></div>}
          <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required /></div>
          {message && <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p>}
          <Button type="submit" disabled={busy || recovering} className="w-full rounded-xl">{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar acesso"}</Button>
        </form>
        {mode === "login" && (
          <button
            type="button"
            onClick={recoverPassword}
            disabled={recovering}
            className="mt-4 w-full text-center text-sm font-semibold text-primary hover:underline disabled:opacity-50"
          >
            {recovering ? "Enviando recuperação..." : "Esqueci minha senha"}
          </button>
        )}
        {pendingInvite ? (
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }} className="mt-5 w-full text-center text-sm font-semibold text-primary hover:underline">
            {mode === "login" ? "Criar acesso com este convite" : "Já tenho uma conta"}
          </button>
        ) : (
          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
            Novo por aqui? O cadastro é liberado exclusivamente por convite da administração.
          </p>
        )}
      </section>
    </main>
  );
}
