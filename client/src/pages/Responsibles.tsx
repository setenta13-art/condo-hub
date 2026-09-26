import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Building2, Edit3, Loader2, Save, Search, ShieldCheck, Trash2, UsersRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type Role = "resident" | "staff" | "manager" | "admin";
type Editing = { id: number; role: Role; unit: string; block: string } | null;
type Member = { id?: number; role: string; unit: string | null; block: string | null; user: { name: string | null; email: string | null } };
const roleLabels: Record<Role, string> = { resident: "Morador", staff: "Funcionário", manager: "Gestor", admin: "Administrador" };

export default function Responsibles() {
  const { user } = useAuth();
  const { data: rows, isLoading, error } = trpc.responsibles.list.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.responsibles.update.useMutation({ onSuccess: async () => { await utils.responsibles.list.invalidate(); setEditing(null); } });
  const remove = trpc.responsibles.remove.useMutation({ onSuccess: () => utils.responsibles.list.invalidate() });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Editing>(null);

  const filtered = useMemo(() => ((rows ?? []) as Member[]).filter(row => `${row.user.name ?? ""} ${row.user.email ?? ""} ${row.block ?? ""} ${row.unit ?? ""}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const groups = useMemo(() => {
    const grouped = new Map<string, Member[]>();
    filtered.forEach(row => {
      const key = `${row.block || "Sem bloco"} · ${row.unit ? `Unidade ${row.unit}` : "Unidade não informada"}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    });
    return Array.from(grouped.entries());
  }, [filtered]);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="mx-auto max-w-xl rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-destructive" /><h1 className="mt-4 text-xl font-extrabold">Acesso não autorizado</h1><p className="mt-2 text-sm text-muted-foreground">A gestão de responsáveis está disponível apenas para a administração do condomínio.</p><Link href="/" className="mt-5 inline-flex text-sm font-bold text-primary">Voltar para a visão geral</Link></div>;

  return <div className="mx-auto max-w-[1180px] space-y-7">
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><UsersRound className="h-3.5 w-3.5" /> Administração de acessos</div><h1 className="text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">Responsáveis por unidade</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Visualize quem está associado a cada unidade e mantenha os vínculos atualizados.</p></div><div className="flex items-center gap-2 rounded-xl bg-primary/[0.08] px-3 py-2 text-xs font-bold text-primary"><Building2 className="h-4 w-4" /> {rows?.length ?? 0} vínculos ativos</div></header>
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail, bloco ou unidade" className="h-11 rounded-xl pl-9" /></div><p className="text-xs text-muted-foreground">Administrador: <strong className="text-foreground">{user?.name || user?.email}</strong></p></div>
    {groups.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><UsersRound className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 font-extrabold">Nenhum responsável encontrado</h2><p className="mt-2 text-sm text-muted-foreground">Crie convites com bloco e unidade para começar a organizar os responsáveis.</p></div> : <div className="grid gap-5 md:grid-cols-2">{groups.map(([group, members]) => <section key={group} className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_8px_28px_-24px_rgba(20,40,70,0.4)]"><div className="mb-4 flex items-center justify-between border-b border-border/70 pb-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Unidade</p><h2 className="mt-1 text-lg font-extrabold">{group}</h2></div><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{members.length} {members.length === 1 ? "responsável" : "responsáveis"}</span></div><div className="space-y-3">{members.map(row => {
      const isEditing = editing?.id === Number(row.id);
      if (isEditing) {
        const current = editing as Exclude<Editing, null>;
        return <div key={row.id} className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3"><div className="grid gap-2 sm:grid-cols-2"><Input value={current.block} onChange={event => setEditing({ ...current, block: event.target.value })} placeholder="Bloco" className="h-9 rounded-lg" /><Input value={current.unit} onChange={event => setEditing({ ...current, unit: event.target.value })} placeholder="Unidade" className="h-9 rounded-lg" /><select value={current.role} onChange={event => setEditing({ ...current, role: event.target.value as Role })} className="h-9 rounded-lg border border-border bg-background px-2 text-xs sm:col-span-2"><option value="resident">Morador</option><option value="staff">Funcionário</option><option value="manager">Gestor</option><option value="admin" disabled={user?.role !== "admin"}>Administrador</option></select></div><div className="mt-3 flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)} className="h-8 rounded-lg bg-background px-3 text-xs"><X className="mr-1 h-3.5 w-3.5" />Cancelar</Button><Button onClick={() => update.mutate({ id: current.id, role: current.role, unit: current.unit, block: current.block })} disabled={update.isPending} className="h-8 rounded-lg px-3 text-xs"><Save className="mr-1 h-3.5 w-3.5" />Salvar</Button></div></div>;
      }
      const initials = (row.user.name || "U").split(" ").slice(0, 2).map((part: string) => part[0]).join("").toUpperCase();
      return <div key={row.id} className="flex items-center gap-3 rounded-xl bg-muted/55 p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{row.user.name || "Nome não informado"}</p><p className="truncate text-xs text-muted-foreground">{row.user.email || "E-mail não informado"}</p><span className="mt-1 inline-flex rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{roleLabels[row.role as Role]}</span></div><div className="flex shrink-0 items-center gap-1"><Button variant="ghost" onClick={() => setEditing({ id: Number(row.id), role: row.role as Role, unit: row.unit ?? "", block: row.block ?? "" })} className="h-8 w-8 rounded-lg p-0" title="Editar vínculo"><Edit3 className="h-3.5 w-3.5" /></Button><Button variant="ghost" onClick={() => { if (window.confirm(`Remover ${row.user.name || "este responsável"} do vínculo?`)) remove.mutate({ id: Number(row.id) }); }} className="h-8 w-8 rounded-lg p-0 text-destructive hover:text-destructive" title="Remover vínculo"><Trash2 className="h-3.5 w-3.5" /></Button></div></div>;
    })}</div></section>)}</div>}
    <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] px-5 py-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Dica:</strong> para incluir outro responsável em uma unidade, use <Link href="/invites" className="font-bold text-primary">Convites</Link> e informe o mesmo bloco e unidade. O novo vínculo aparecerá aqui após o aceite.</div>
  </div>;
}
