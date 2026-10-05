import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, Link2, Loader2, LogOut, Mail, UserRoundPlus } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

function extractInviteToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const inviteIndex = parts.findIndex(part => part === "invite");
    if (inviteIndex >= 0 && parts[inviteIndex + 1]) return parts[inviteIndex + 1];
  } catch {}

  return /^[A-Za-z0-9_-]{20,96}$/.test(trimmed) ? trimmed : null;
}

export default function AccessPending() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const pending = trpc.invitations.pendingForMe.useQuery(undefined, { retry: false });
  const accept = trpc.invitations.accept.useMutation({
    onSuccess: async () => {
      localStorage.removeItem("condohub-pending-invite");
      sessionStorage.removeItem("condohub-pending-invite");
      await Promise.all([
        utils.condo.dashboard.overview.invalidate(),
        utils.invitations.pendingForMe.invalidate(),
      ]);
      window.location.href = "/";
    },
  });
  const [manualInvite, setManualInvite] = useState("");
  const [manualError, setManualError] = useState("");

  function openManualInvite() {
    const token = extractInviteToken(manualInvite);
    if (!token) {
      setManualError("Cole o link completo do convite ou o código recebido.");
      return;
    }

    setManualError("");
    localStorage.setItem("condohub-pending-invite", token);
    sessionStorage.setItem("condohub-pending-invite", token);
    navigate(`/invite/${token}`);
  }

  const invitations = pending.data ?? [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-4 py-10">
      <div className="w-full max-w-xl rounded-[28px] border border-border/80 bg-card p-7 text-center shadow-[0_24px_70px_-35px_rgba(20,40,70,0.55)] sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Building2 className="h-7 w-7" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-primary">Acesso aguardando vínculo</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">Seu cadastro está criado. Falta ativar o vínculo.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Para acessar comunicados, chamados e documentos, vincule esta conta a um convite enviado pela administração.
        </p>

        {pending.isLoading ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Procurando convites para este e-mail...
          </div>
        ) : invitations.length > 0 ? (
          <div className="mt-6 space-y-3 text-left">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Encontramos {invitations.length === 1 ? "um convite pendente" : "convites pendentes"} para {user?.email}
            </div>
            {invitations.map(invitation => (
              <div key={invitation.token} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
                <p className="font-extrabold">{invitation.condominium.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{invitation.organization.name}</p>
                {(invitation.block || invitation.unit) && (
                  <p className="mt-2 text-sm font-semibold">
                    {invitation.block ?? ""}
                    {invitation.unit ? ` · unidade ${invitation.unit}` : ""}
                  </p>
                )}
                <Button
                  className="mt-4 w-full rounded-xl"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate({ token: invitation.token })}
                >
                  {accept.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundPlus className="mr-2 h-4 w-4" />}
                  Ativar este acesso
                </Button>
              </div>
            ))}
            {accept.error && <p className="text-xs font-semibold text-destructive">{accept.error.message}</p>}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-muted/60 p-4 text-left">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="w-full">
                <p className="text-sm font-bold">Tenho um convite</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Cole abaixo o link completo ou o código do convite enviado pela administração.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={manualInvite}
                    onChange={event => setManualInvite(event.target.value)}
                    placeholder="https://.../invite/... ou código"
                  />
                  <Button onClick={openManualInvite} className="shrink-0 rounded-xl">
                    <Link2 className="mr-2 h-4 w-4" /> Validar convite
                  </Button>
                </div>
                {manualError && <p className="mt-2 text-xs font-semibold text-destructive">{manualError}</p>}
              </div>
            </div>
          </div>
        )}

        <Button variant="outline" onClick={logout} className="mt-6 w-full rounded-xl bg-background">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
        <p className="mt-5 text-[11px] text-muted-foreground">Conta: {user?.email || user?.name || "usuário autenticado"}</p>
      </div>
    </main>
  );
}
