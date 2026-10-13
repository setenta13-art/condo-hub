import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function Login() {
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
    const inviteFromUrl = new URLSearchParams(window.location.search).get(
      "invite"
    );
    if (inviteFromUrl) {
      localStorage.setItem("condohub-pending-invite", inviteFromUrl);
      sessionStorage.setItem("condohub-pending-invite", inviteFromUrl);
    }
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const endpoint =
      mode === "login" ? "/api/auth/sign-in" : "/api/auth/sign-up";
    if (mode === "signup" && !pendingInvite) {
      setBusy(false);
      setMessage("Novos acessos só podem ser criados por um convite válido.");
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          email,
          password,
          name,
          inviteToken: pendingInvite,
        }),
      });
      const result = await response.json().catch(() => ({}));
      setBusy(false);
      if (!response.ok) {
        const rawError = String(result.error ?? "");
        const friendlyError = rawError
          .toLowerCase()
          .includes("invalid login credentials")
          ? "E-mail ou senha inválidos. Se você acabou de confirmar o cadastro, confira a senha digitada ou use “Esqueci minha senha”."
          : rawError || "Não foi possível concluir a operação.";
        setMessage(friendlyError);
        return;
      }
      if (result.needsEmailConfirmation) {
        // Supabase deliberately returns success for an already confirmed account
        // too. Never claim that a new account or confirmation email was created.
        setMessage(
          "Solicitação recebida. Se este e-mail ainda não tinha cadastro, confira a mensagem de confirmação, inclusive no spam. Se já possui conta, entre com a senha anterior ou use “Esqueci minha senha”."
        );
        setMode("login");
        setPassword("");
        return;
      }
      if (result.inviteAccepted) {
        localStorage.removeItem("condohub-pending-invite");
        sessionStorage.removeItem("condohub-pending-invite");
        // O redirecionamento abaixo aguarda a atualização completa da sessão.
      }
      window.location.href = result.inviteAccepted
        ? "/"
        : pendingInvite
          ? `/invite/${encodeURIComponent(pendingInvite)}`
          : "/";
    } catch {
      setBusy(false);
      setMessage("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  async function recoverPassword() {
    if (!email.trim()) {
      setMessage("Informe seu e-mail para receber o link de recuperação.");
      return;
    }

    setRecovering(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          inviteToken: pendingInvite,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json().catch(() => ({}));
      setRecovering(false);

      if (!response.ok) {
        setMessage(result.error ?? "Não foi possível enviar a recuperação.");
        return;
      }

      setMessage(
        "Enviamos um link para redefinir sua senha. Ao concluir, seu acesso continuará do ponto em que parou."
      );
    } catch {
      setMessage("Falha de conexão. Tente solicitar a recuperação novamente.");
    } finally {
      setRecovering(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-9">
        <Link href="/" className="text-sm font-semibold text-primary">
          ← Voltar para o CondoHub
        </Link>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">
          {mode === "login" ? "Entrar na sua conta" : "Criar acesso"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {mode === "signup"
            ? "Crie um acesso apenas se ainda não possui conta no CondoHub. Para aceitar outro convite, use sua conta existente."
            : "Use o e-mail autorizado pela administração do seu condomínio."}
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {message && (
            <p
              role="status"
              className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              {message}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy || recovering}
            className="w-full rounded-xl"
          >
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar acesso"}
          </Button>
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
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setMessage("");
            }}
            className="mt-5 w-full text-center text-sm font-semibold text-primary hover:underline"
          >
            {mode === "login"
              ? "Criar acesso com este convite"
              : "Já tenho uma conta"}
          </button>
        ) : (
          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
            Novo por aqui? O cadastro é liberado exclusivamente por convite da
            administração.
          </p>
        )}
      </section>
    </main>
  );
}
