import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, Clock3, Loader2, LogIn, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useEffect } from "react";

const roles: Record<string, string> = { resident: "Morador", staff: "Funcionário", manager: "Gestor" };

function formatDate(value: Date | string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value)); }

export default function Invite() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const { isAuthenticated, user } = useAuth();
  const { data: preview, isLoading, error } = trpc.invitations.preview.useQuery({ token }, { enabled: Boolean(token), retry: false });
  const accept = trpc.invitations.accept.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (isAuthenticated && preview?.status === "pending" && !accept.isPending && !accept.isSuccess) {
      accept.mutate({ token });
    }
  }, [accept, isAuthenticated, preview?.status, token]);

  useEffect(() => {
    if (!accept.isSuccess) return;
    sessionStorage.removeItem("condohub-pending-invite");
    void utils.condo.dashboard.overview.invalidate();
  }, [accept.isSuccess, utils]);

  if (!token) return <InviteShell><UserPlus className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-4 text-xl font-extrabold">Aceitar um convite</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">O convite é enviado pela administração por e-mail ou mensagem. Abra o link recebido para conferir o condomínio, a unidade e concluir seu vínculo.</p><div className="mt-5 rounded-xl bg-muted/60 p-3 text-left text-xs leading-5 text-muted-foreground">O formato do link é semelhante a <strong className="text-foreground">condohub.../invite/...</strong>.</div><Link href="/" className="mt-5 inline-flex text-sm font-bold text-primary">Voltar para o início</Link></InviteShell>;
  if (isLoading) return <InviteShell><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-4 text-sm text-muted-foreground">Validando seu convite...</p></InviteShell>;
  if (error || !preview) return <InviteShell><XCircle className="mx-auto h-10 w-10 text-destructive" /><h1 className="mt-4 text-xl font-extrabold">Convite indisponível</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Este link não existe ou não está mais disponível. Solicite um novo convite à administração.</p><Link href="/" className="mt-5 inline-flex text-sm font-bold text-primary">Ir para o início</Link></InviteShell>;
  if (preview.status === "expired" || preview.status === "revoked") return <InviteShell><Clock3 className="mx-auto h-10 w-10 text-[#b77a20]" /><h1 className="mt-4 text-xl font-extrabold">Convite expirado</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Este convite não pode mais ser utilizado. Solicite um novo link à administração.</p><Link href="/" className="mt-5 inline-flex text-sm font-bold text-primary">Ir para o início</Link></InviteShell>;
  if (preview.status === "accepted") return <InviteShell><CheckCircle2 className="mx-auto h-10 w-10 text-[#2b8b50]" /><h1 className="mt-4 text-xl font-extrabold">Convite já utilizado</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Este convite já foi aceito anteriormente.</p><Link href="/" className="mt-5 inline-flex text-sm font-bold text-primary">Acessar o CondoHub</Link></InviteShell>;

  return <InviteShell><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Building2 className="h-7 w-7" /></div><div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Convite oficial</div><h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">Você foi convidado</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Acesse o espaço digital do seu condomínio e mantenha tudo importante organizado em um só lugar.</p><div className="mt-6 rounded-2xl border border-border/80 bg-muted/50 p-4 text-left"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Condomínio</p><p className="mt-1 text-base font-extrabold">{preview.condominium.name}</p><p className="mt-1 text-xs text-muted-foreground">{preview.organization.name} · acesso como {roles[preview.role]}</p>{(preview.block || preview.unit) && <p className="mt-2 text-xs font-semibold text-muted-foreground">{preview.block ? `${preview.block}` : ""}{preview.unit ? ` · unidade ${preview.unit}` : ""}</p>}<p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Válido até {formatDate(preview.expiresAt)}</p></div>{accept.error && <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-left text-xs font-semibold leading-5 text-destructive">{accept.error.message}</div>}{!isAuthenticated ? <><p className="mt-5 text-xs text-muted-foreground">Entre ou crie seu acesso. Depois do login, o vínculo será ativado automaticamente.</p><Button onClick={() => { sessionStorage.setItem("condohub-pending-invite", token); startLogin(); }} className="mt-3 w-full rounded-xl"><LogIn className="mr-2 h-4 w-4" />Entrar e ativar acesso</Button></> : accept.isSuccess ? <div className="mt-5 rounded-xl bg-[#e4f5e8] p-4 text-left text-xs leading-5 text-[#2b8b50]"><p className="font-extrabold">Acesso ativado com sucesso.</p><p className="mt-1">Seu usuário agora está vinculado ao condomínio e à unidade do convite.</p><Link href="/" className="mt-3 inline-flex font-bold underline">Acessar painel</Link></div> : <><p className="mt-5 text-xs text-muted-foreground">Ativando o acesso para <strong className="text-foreground">{user?.email || user?.name}</strong>...</p><Button disabled className="mt-3 w-full rounded-xl"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ativando seu acesso</Button></>}{accept.isError && <p className="mt-3 text-xs text-muted-foreground">Se você entrou com outra conta, saia e abra novamente o link usando o e-mail indicado no convite.</p>}</InviteShell>;
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4 py-10"><div className="w-full max-w-md rounded-[26px] border border-border/80 bg-card p-7 text-center shadow-[0_24px_70px_-35px_rgba(20,40,70,0.55)] sm:p-9">{children}<p className="mt-8 text-[11px] font-semibold text-muted-foreground">CondoHub · Gestão que aproxima</p></div></main>;
}
