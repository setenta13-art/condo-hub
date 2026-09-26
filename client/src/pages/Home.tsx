import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  LogIn,
  Megaphone,
  Plus,
  Sparkles,
  Timer,
  Wrench,
} from "lucide-react";
import { Link } from "wouter";

const demoAnnouncements = [
  {
    id: 1,
    title: "Manutenção preventiva dos elevadores",
    summary: "A revisão acontece na próxima terça-feira, das 9h às 13h.",
    category: "maintenance",
    publishedAt: new Date("2026-09-24T13:00:00Z"),
    isPinned: 1,
  },
  {
    id: 2,
    title: "Assembleia extraordinária — espaço gourmet",
    summary: "Confira a pauta e participe da decisão sobre a nova área comum.",
    category: "event",
    publishedAt: new Date("2026-09-22T13:00:00Z"),
    isPinned: 0,
  },
  {
    id: 3,
    title: "Prestação de contas — agosto/2026",
    summary: "O relatório financeiro já está disponível na área de documentos.",
    category: "finance",
    publishedAt: new Date("2026-09-18T13:00:00Z"),
    isPinned: 0,
  },
];

const demoTickets = [
  { id: 21, title: "Luz do corredor do 3º andar", category: "maintenance", status: "in_progress", priority: "medium" },
  { id: 22, title: "Vazamento próximo à garagem", category: "maintenance", status: "open", priority: "high" },
];

const demoDocuments = [
  { id: 31, title: "Regulamento interno", category: "rules", createdAt: new Date("2026-09-12T13:00:00Z") },
  { id: 32, title: "Ata da assembleia — maio/2026", category: "meeting", createdAt: new Date("2026-08-10T13:00:00Z") },
];

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value));
}

function categoryLabel(category: string) {
  return ({ maintenance: "Manutenção", finance: "Financeiro", event: "Evento", general: "Geral" } as Record<string, string>)[category] ?? "Geral";
}

function statusLabel(status: string) {
  return ({ open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido" } as Record<string, string>)[status] ?? status;
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: overview } = trpc.condo.dashboard.overview.useQuery(undefined, { enabled: isAuthenticated });
  const announcements = overview?.announcements ?? demoAnnouncements;
  const tickets = overview?.tickets ?? demoTickets;
  const documents = overview?.documents ?? demoDocuments;
  const counts = overview?.counts ?? { announcements: 12, tickets: 8, openTickets: 3, documents: 24 };
  const condominium = overview?.scope.condominium;
  const organization = overview?.scope.organization;

  return (
    <div className="mx-auto max-w-[1360px] space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Central do morador
          </div>
          <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-foreground sm:text-3xl">
            Olá, {user?.name?.split(" ")[0] ?? "vizinhança"}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Tudo o que importa para o seu condomínio, em um só lugar.</p>
        </div>
        <div className="flex items-center gap-3">
          {!isAuthenticated && (
            <Button variant="outline" onClick={() => startLogin()} className="rounded-xl bg-background">
              <LogIn className="mr-2 h-4 w-4" /> Entrar
            </Button>
          )}
          <Link href="/tickets">
            <Button className="rounded-xl bg-primary px-4 shadow-[0_8px_20px_-10px_hsl(var(--primary))] hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Abrir chamado
            </Button>
          </Link>
        </div>
      </header>

      {!isAuthenticated && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.07] px-4 py-3 text-sm text-primary sm:px-5">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span><strong>Modo demonstração:</strong> explore a experiência e entre para acessar os dados reais do seu condomínio.</span>
        </div>
      )}

      <section className="relative overflow-hidden rounded-[26px] bg-[#152e3b] px-6 py-7 text-white shadow-[0_18px_50px_-24px_rgba(20,44,57,0.65)] sm:px-8 sm:py-8">
        <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border-[28px] border-[#b5dfd3]/10" />
        <div className="absolute -bottom-28 right-28 h-64 w-64 rounded-full border-[1px] border-[#b5dfd3]/10" />
        <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#b5dfd3]">
              <span className="rounded-full bg-[#b5dfd3]/15 px-2.5 py-1">Condomínio ativo</span>
              <span className="h-1 w-1 rounded-full bg-[#b5dfd3]/60" />
              <span>{organization?.name ?? "Administradora Horizonte"}</span>
            </div>
            <h2 className="max-w-xl text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">{condominium?.name ?? "Residencial Jardim do Lago"}</h2>
            <p className="mt-2 text-sm text-white/65">{condominium?.city ?? "Belo Horizonte"} · 128 unidades · comunicação oficial</p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:min-w-[450px]">
            <div><p className="text-2xl font-extrabold">98%</p><p className="mt-1 text-xs text-white/55">comunicados lidos</p></div>
            <div><p className="text-2xl font-extrabold">2h</p><p className="mt-1 text-xs text-white/55">tempo médio de resposta</p></div>
            <div><p className="text-2xl font-extrabold">24</p><p className="mt-1 text-xs text-white/55">documentos ativos</p></div>
            <div><p className="text-2xl font-extrabold">{counts.openTickets}</p><p className="mt-1 text-xs text-white/55">chamados abertos</p></div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Comunicados", value: counts.announcements, helper: "atualizações recentes", icon: Megaphone, tone: "teal" },
          { label: "Meus chamados", value: counts.tickets, helper: `${counts.openTickets} aguardando atenção`, icon: ClipboardList, tone: "purple" },
          { label: "Documentos", value: counts.documents, helper: "arquivos disponíveis", icon: FileText, tone: "amber" },
          { label: "Atendimento", value: "Online", helper: "equipe disponível hoje", icon: CheckCircle2, tone: "green" },
        ].map(item => (
          <div key={item.label} className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_8px_28px_-24px_rgba(20,40,70,0.4)] transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone === "teal" ? "bg-[#dff5ef] text-[#18796c]" : item.tone === "purple" ? "bg-[#eee8ff] text-[#7652c8]" : item.tone === "amber" ? "bg-[#fff3d9] text-[#b77a20]" : "bg-[#e4f5e8] text-[#2b8b50]"}`}>
                <item.icon className="h-[18px] w-[18px]" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <p className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">{item.value}</p>
            <p className="mt-1 text-sm font-semibold">{item.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Comunicação oficial</p><h3 className="mt-1 text-lg font-extrabold tracking-[-0.03em]">Últimos comunicados</h3></div>
            <Link href="/announcements" className="flex items-center gap-1 text-xs font-bold text-primary transition hover:gap-2">Ver todos <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="divide-y divide-border/70">
            {announcements.map((announcement, index) => (
              <div key={announcement.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${index === 0 ? "bg-[#dff5ef] text-[#18796c]" : index === 1 ? "bg-[#eee8ff] text-[#7652c8]" : "bg-[#fff3d9] text-[#b77a20]"}`}>
                  {index === 0 ? <Wrench className="h-4 w-4" /> : index === 1 ? <Bell className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">{categoryLabel(announcement.category)}</span>{announcement.isPinned === 1 && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">Fixado</span>}</div>
                  <h4 className="mt-1 truncate text-sm font-bold">{announcement.title}</h4>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{announcement.summary}</p>
                </div>
                <time className="shrink-0 pt-1 text-[11px] font-medium text-muted-foreground">{formatDate(announcement.publishedAt)}</time>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Acompanhe</p><h3 className="mt-1 text-lg font-extrabold tracking-[-0.03em]">Chamados recentes</h3></div><Link href="/tickets" className="text-xs font-bold text-primary">Acessar</Link></div>
            <div className="space-y-3">
              {tickets.slice(0, 3).map(ticket => <div key={ticket.id} className="rounded-xl bg-muted/60 p-3"><div className="flex items-start justify-between gap-3"><p className="line-clamp-1 text-sm font-bold">{ticket.title}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${ticket.status === "resolved" ? "bg-[#e4f5e8] text-[#2b8b50]" : ticket.status === "in_progress" ? "bg-[#fff3d9] text-[#a96c12]" : "bg-[#eee8ff] text-[#7652c8]"}`}>{statusLabel(ticket.status)}</span></div><p className="mt-1 text-[11px] capitalize text-muted-foreground">{categoryLabel(ticket.category)} · prioridade {ticket.priority === "high" ? "alta" : ticket.priority === "low" ? "baixa" : "média"}</p></div>)}
            </div>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Acesso rápido</p><h3 className="mt-1 text-lg font-extrabold tracking-[-0.03em]">Documentos recentes</h3></div><Link href="/documents" className="text-xs font-bold text-primary">Ver biblioteca</Link></div><div className="space-y-2.5">{documents.slice(0, 2).map(document => <Link key={document.id} href="/documents" className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-muted"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff3d9] text-[#b77a20]"><FileText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{document.title}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{categoryLabel(document.category)} · {document.createdAt ? formatDate(document.createdAt) : "Recente"}</p></div><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></Link>)}</div></div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Timer className="h-4 w-4" /></div><p className="text-xs text-muted-foreground"><strong className="text-foreground">Mais clareza, menos ruído.</strong> Toda solicitação fica registrada e acompanhada pela equipe.</p></div><Link href="/tickets" className="hidden text-xs font-bold text-primary sm:block">Acompanhar atendimento <ChevronRight className="ml-1 inline h-3.5 w-3.5" /></Link></div>
    </div>
  );
}
