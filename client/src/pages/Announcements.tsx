import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Bell, CalendarDays, ChevronRight, Loader2, Megaphone, Pin, Plus, Send, Wrench, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const demoAnnouncements = [
  { id: 1, title: "Manutenção preventiva dos elevadores", summary: "A revisão acontece na próxima terça-feira, das 9h às 13h. Durante o período, utilize as escadas quando possível.", body: "", category: "maintenance", publishedAt: new Date("2026-09-24T13:00:00Z"), isPinned: 1 },
  { id: 2, title: "Assembleia extraordinária — espaço gourmet", summary: "Confira a pauta e participe da decisão sobre a nova área comum.", body: "", category: "event", publishedAt: new Date("2026-09-22T13:00:00Z"), isPinned: 0 },
  { id: 3, title: "Prestação de contas — agosto/2026", summary: "O relatório financeiro já está disponível na área de documentos.", body: "", category: "finance", publishedAt: new Date("2026-09-18T13:00:00Z"), isPinned: 0 },
  { id: 4, title: "Boas-vindas ao novo canal de comunicação", summary: "Agora todos os avisos importantes ficam organizados, acessíveis e com histórico.", body: "", category: "general", publishedAt: new Date("2026-09-10T13:00:00Z"), isPinned: 0 },
];

const labels: Record<string, string> = { maintenance: "Manutenção", finance: "Financeiro", event: "Evento", general: "Geral" };

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

export default function Announcements() {
  const { isAuthenticated } = useAuth();
  const { data: overview } = trpc.condo.dashboard.overview.useQuery(undefined, { enabled: isAuthenticated });
  const { data } = trpc.condo.announcements.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const create = trpc.condo.announcements.create.useMutation({ onSuccess: async () => { await utils.condo.announcements.list.invalidate(); await utils.condo.dashboard.overview.invalidate(); setShowForm(false); setForm({ title: "", summary: "", body: "", category: "general", isPinned: false }); } });
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", summary: "", body: "", category: "general" as "maintenance" | "finance" | "event" | "general", isPinned: false });
  const announcements = data ?? demoAnnouncements;
  const isStaff = overview?.scope.isStaff ?? false;
  const filtered = filter === "all" ? announcements : announcements.filter(item => item.category === filter);

  return (
    <div className="mx-auto max-w-[1100px] space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Megaphone className="h-3.5 w-3.5" /> Comunicação oficial</div><h1 className="text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">Comunicados</h1><p className="mt-1 text-sm text-muted-foreground">Informação clara, no momento certo e para as pessoas certas.</p></div>
        {isStaff ? <Button onClick={() => setShowForm(value => !value)} className="rounded-xl">{showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{showForm ? "Fechar" : "Novo comunicado"}</Button> : <div className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">Canal oficial do condomínio</div>}
      </header>

      {showForm && <form onSubmit={event => { event.preventDefault(); create.mutate(form); }} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Send className="h-4 w-4" /></div><div><h2 className="font-extrabold">Publicar comunicado</h2><p className="text-xs text-muted-foreground">O aviso ficará disponível para os moradores do condomínio ativo.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Título</span><input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Interdição da garagem no sábado" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Resumo</span><input required value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} placeholder="Uma frase que ajude o morador a entender o aviso" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><label><span className="mb-1.5 block text-xs font-bold">Categoria</span><select value={form.category} onChange={event => setForm({ ...form, category: event.target.value as typeof form.category })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"><option value="general">Geral</option><option value="maintenance">Manutenção</option><option value="finance">Financeiro</option><option value="event">Evento</option></select></label><label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={form.isPinned} onChange={event => setForm({ ...form, isPinned: event.target.checked })} className="h-4 w-4 accent-[oklch(0.51_0.16_190)]" /> Fixar no topo</label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Mensagem completa</span><textarea required value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} placeholder="Detalhe o comunicado para quem precisa da informação..." className="min-h-[110px] w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></label></div><div className="mt-4 flex justify-end"><Button type="submit" disabled={create.isPending} className="rounded-xl">{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publicar agora</Button></div></form>}

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">{[["all", "Todos"], ["maintenance", "Manutenção"], ["event", "Eventos"], ["finance", "Financeiro"]].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-xs font-bold transition ${filter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>{label}</button>)}</div>

      <div className="space-y-4">{filtered.map((announcement, index) => <article key={announcement.id} className="group rounded-2xl border border-border/80 bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_14px_30px_-24px_rgba(20,50,70,0.5)] sm:p-6"><div className="flex gap-4"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${index % 3 === 0 ? "bg-[#dff5ef] text-[#18796c]" : index % 3 === 1 ? "bg-[#eee8ff] text-[#7652c8]" : "bg-[#fff3d9] text-[#b77a20]"}`}>{index % 3 === 0 ? <Wrench className="h-[18px] w-[18px]" /> : index % 3 === 1 ? <Bell className="h-[18px] w-[18px]" /> : <CalendarDays className="h-[18px] w-[18px]" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">{labels[announcement.category]}</span>{announcement.isPinned === 1 && <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground"><Pin className="h-2.5 w-2.5" /> Fixado</span>}</div><h2 className="mt-1.5 text-base font-extrabold tracking-[-0.02em] sm:text-lg">{announcement.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{announcement.summary}</p><div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Publicado em {formatDate(announcement.publishedAt)}</div></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-1 group-hover:text-primary" /></div></article>)}
      </div>
      {!isAuthenticated && <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] p-5 text-center"><p className="text-sm font-bold">Quer publicar ou acompanhar os comunicados do seu condomínio?</p><Button variant="outline" onClick={() => startLogin()} className="mt-3 rounded-xl bg-background">Entrar na plataforma</Button></div>}
      <Link href="/" className="inline-flex items-center text-xs font-bold text-primary">← Voltar para a visão geral</Link>
    </div>
  );
}
