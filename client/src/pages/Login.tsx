import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const endpoint = mode === "login" ? "/api/auth/sign-in" : "/api/auth/sign-up";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, name }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Não foi possível concluir a operação.");
      return;
    }
    if (result.needsEmailConfirmation) {
      setMessage("Cadastro criado. Confirme seu e-mail antes de entrar.");
      return;
    }
    navigate("/");
    window.location.reload();
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
          <Button type="submit" disabled={busy} className="w-full rounded-xl">{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar acesso"}</Button>
        </form>
        <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }} className="mt-5 w-full text-center text-sm font-semibold text-primary hover:underline">
          {mode === "login" ? "Ainda não tenho acesso" : "Já tenho uma conta"}
        </button>
      </section>
    </main>
  );
}
