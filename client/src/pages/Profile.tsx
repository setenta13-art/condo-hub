import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, Home, Loader2, Mail, Save, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function Profile() {
  const { user } = useAuth();
  const { data, isLoading } = trpc.profile.get.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.profile.update.useMutation({ onSuccess: async () => { await utils.profile.get.invalidate(); await utils.auth.me.invalidate(); setSaved(true); setTimeout(() => setSaved(false), 2200); } });
  const [name, setName] = useState(user?.name ?? "");
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (data?.user.name) setName(data.user.name); }, [data?.user.name]);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const membership = data?.membership;
  const isPlatformAdmin = user?.role === "admin";
  const unitLabel = membership?.unit
    ? `${membership.block ? `${membership.block} · ` : ""}unidade ${membership.unit}`
    : isPlatformAdmin
      ? "Não se aplica ao administrador da plataforma"
      : "Unidade ainda não informada";

  return <div className="mx-auto max-w-[980px] space-y-7"><header><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">Minha conta</p><h1 className="text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">Perfil e unidade</h1><p className="mt-1 text-sm text-muted-foreground">Mantenha seus dados atualizados e veja quem está associado à sua unidade.</p></header>{saved && <div className="flex items-center gap-2 rounded-2xl border border-[#bfe8c9] bg-[#e4f5e8] px-4 py-3 text-sm font-semibold text-[#287d47]"><CheckCircle2 className="h-4 w-4" /> Dados atualizados.</div>}<div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]"><section className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6"><div className="mb-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mail className="h-5 w-5" /></div><div><h2 className="font-extrabold">Dados pessoais</h2><p className="text-xs text-muted-foreground">Visíveis para a administração do condomínio.</p></div></div><form onSubmit={event => { event.preventDefault(); update.mutate({ name }); }} className="space-y-4"><div><Label htmlFor="name">Nome completo</Label><Input id="name" value={name} onChange={event => setName(event.target.value)} className="mt-1.5 h-11 rounded-xl" required minLength={2} /></div><div><Label htmlFor="email">E-mail de acesso</Label><Input id="email" value={data?.user.email ?? ""} readOnly className="mt-1.5 h-11 rounded-xl bg-muted/60" /><p className="mt-1.5 text-[11px] text-muted-foreground">O e-mail é usado para autenticação e não pode ser alterado aqui.</p></div><Button type="submit" disabled={update.isPending || name.trim().length < 2} className="w-full rounded-xl">{update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar dados</Button></form></section><section className="space-y-6"><div className="rounded-2xl bg-[#152e3b] p-6 text-white"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b5dfd3]/15 text-[#b5dfd3]"><Home className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b5dfd3]">Vínculo atual</p><h2 className="mt-1 text-lg font-extrabold">{data?.condominium?.name ?? "Nenhum condomínio"}</h2></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white/[0.08] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/55">Unidade</p><p className="mt-1 text-sm font-bold">{unitLabel}</p></div><div className="rounded-xl bg-white/[0.08] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-white/55">Perfil</p><p className="mt-1 text-sm font-bold">{isPlatformAdmin ? "Administrador da plataforma" : membership?.role === "resident" ? "Morador" : membership?.role ?? "Sem vínculo"}</p></div></div></div><div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound className="h-5 w-5" /></div><div><h2 className="font-extrabold">Responsáveis da unidade</h2><p className="text-xs text-muted-foreground">Pessoas associadas ao mesmo bloco e unidade.</p></div></div><div className="mt-5 space-y-3">{data?.responsibleUsers?.length ? data.responsibleUsers.map(item => <div key={item.user.id} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-3"><div><p className="text-sm font-bold">{item.user.name || "Usuário"}{item.user.id === data.user.id && <span className="ml-2 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">Você</span>}</p><p className="mt-1 text-xs text-muted-foreground">{item.user.email || "E-mail não informado"}</p></div><span className="text-[10px] font-bold text-muted-foreground">{item.membership.role === "resident" ? "Morador" : item.membership.role}</span></div>) : <div className="rounded-xl border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">Nenhum outro responsável está associado. Para incluir alguém, peça à administração um convite com o mesmo bloco e unidade.</div>}</div>{isPlatformAdmin && !data?.condominium ? (
  <Link href="/setup" className="mt-4 inline-flex text-xs font-bold text-primary">Configure o primeiro condomínio para liberar os módulos operacionais →</Link>
) : (
  <Link href="/invites" className="mt-4 inline-flex text-xs font-bold text-primary">A administração pode gerar convites para novos responsáveis →</Link>
)}</div></section></div></div>;
}
