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
  Settings2,
  Timer,
  Wrench,
} from "lucide-react";
import { Link } from "wouter";

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
  const announcements = overview?.announcements ?? [];
  const tickets = overview?.tickets ?? [];
  const documents = overview?.documents ?? [];
  const counts = overview?.counts ?? { announcements: 0, tickets: 0, openTickets: 0, documents: 0, units: 0 };
  const condominium = overview?.scope?.condominium;
  const organization = overview?.scope?.organization;
  const hasScope = Boolean(overview?.scope);
  const isPlatformAdmin = user?.role === "admin";

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
          {hasScope ? (
            <Link href="/tickets">
              <Button className="rounded-xl bg-primary px-4 shadow-[0_8px_20px_-10px_hsl(var(--primary))] hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" /> Abrir chamado
              </Button>
            </Link>
          ) : isPlatformAdmin ? (
            <Link href="/setup">
              <Button className="rounded-xl bg-primary px-4 shadow-[0_8px_20px_-10px_hsl(var(--primary))] hover:bg-primary/90">
                <Settings2 className="mr-2 h-4 w-4" /> Configurar estrutura
              </Button>
            </Link>
          ) : null}
        </div>
      </header>

      {!isAuthenticated && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.07] px-4 py-3 text-sm text-primary sm:px-5">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span><strong>Modo demonstração:</strong> explore a experiência e entre para acessar os dados reais do seu condomínio.</span>
        </div>
      )}

      {isAuthenticated && overview && !overview.scope && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#f0dca8] bg-[#fff8e7] px-4 py-3 text-sm text-[#8c651f] sm:px-5">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>
            {isPlatformAdmin ? (
              <><strong>Estrutura ainda não configurada:</strong> cadastre a administradora, o primeiro condomínio, blocos e unidades para começar a operação.</>
            ) : (
              <><strong>Conta ainda sem vínculo:</strong> aceite um convite ou peça à administração para vincular seu usuário a um condomínio.</>
            )}
          </span>
        </div>
      )}

      {hasScope ? (
        <section className="relative overflow-hidden rounded-[26px] bg-[#152e3b] px-6 py-7 text-white shadow-[0_18px_50px_-24px_rgba(20,44,57,0.65)] sm:px-8 sm:py-8">
          <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border-[28px] border-[#b5dfd3]/10" />
          <div className="absolute -bottom-28 right-28 h-64 w-64 rounded-full border-[1px] border-[#b5dfd3]/10" />
          <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#b5dfd3]">
                <span className="rounded-full bg-[#b5dfd3]/15 px-2.5 py-1">Condomínio ativo</span>
                <span className="h-1 w-1 rounded-full bg-[#b5dfd3]/60" />
                <span>{organization?.name}</span>
              </div>
              <h2 className="max-w-xl text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">{condominium?.name}</h2>
              <p className="mt-2 text-sm text-white/65">{condominium?.city ?? "Sem cidade cadastrada"} · {counts.units} unidades ativas · comunicação oficial</p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:min-w-[450px]">
              <div><p className="text-2xl font-extrabold">{counts.announcements}</p><p className="mt-1 text-xs text-white/55">comunicados</p></div>
              <div><p className="text-2xl font-extrabold">{counts.units}</p><p className="mt-1 text-xs text-white/55">unidades ativas</p></div>
              <div><p className="text-2xl font-extrabold">{counts.documents}</p><p className="mt-1 text-xs text-white/55">documentos ativos</p></div>
              <div><p className="text-2xl font-extrabold">{counts.openTickets}</p><p className="mt-1 text-xs text-white/55">chamados abertos</p></div>
            </div>
          </div>
        </section>
      ) : isPlatformAdmin ? (
        <section className="rounded-[26px] bg-[#152e3b] px-6 py-8 text-white shadow-[0_18px_50px_-24px_rgba(20,44,57,0.65)] sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b5dfd3]">Configuração inicial</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">Nenhum condomínio configurado ainda.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">Cadastre a administradora e o primeiro condomínio para liberar blocos, unidades, convites e os demais módulos operacionais.</p>
          <Link href="/setup">
            <Button className="mt-5 rounded-xl bg-white text-[#152e3b] hover:bg-white/90">
              <Settings2 className="mr-2 h-4 w-4" /> Ir para configuração
            </Button>
          </Link>
        </section>
      ) : null}

      {hasScope && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Comunicados", value: counts.announcements, helper: "atualizações recentes", icon: Megaphone, tone: "teal", path: "/announcements" },
          { label: "Meus chamados", value: counts.tickets, helper: `${counts.openTickets} aguardando atenção`, icon: ClipboardList, tone: "purple", path: "/tickets" },
          { label: "Documentos", value: counts.documents, helper: "arquivos disponíveis", icon: FileText, tone: "amber", path: "/documents" },
          { label: "Atendimento", value: counts.openTickets, helper: "chamados aguardando atenção", icon: CheckCircle2, tone: "green", path: "/tickets" },
        ].map(item => (
          <Link key={item.label} href={item.path} className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_8px_28px_-24px_rgba(20,40,70,0.4)] transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone === "teal" ? "bg-[#dff5ef] text-[#18796c]" : item.tone === "purple" ? "bg-[#eee8ff] text-[#7652c8]" : item.tone === "amber" ? "bg-[#fff3d9] text-[#b77a20]" : "bg-[#e4f5e8] text-[#2b8b50]"}`}>
                <item.icon className="h-[18px] w-[18px]" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <p className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">{item.value}</p>
            <p className="mt-1 text-sm font-semibold">{item.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
          </Link>
        ))}
      </section>}

      {hasScope && <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
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
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">{categoryLabel(announcement.category)}</span>{announcement.isPinned && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">Fixado</span>}</div>
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
      </section>}

      {hasScope && <div className="flex items-center justify-between rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Timer className="h-4 w-4" /></div><p className="text-xs text-muted-foreground"><strong className="text-foreground">Mais clareza, menos ruído.</strong> Toda solicitação fica registrada e acompanhada pela equipe.</p></div><Link href="/tickets" className="hidden text-xs font-bold text-primary sm:block">Acompanhar atendimento <ChevronRight className="ml-1 inline h-3.5 w-3.5" /></Link></div>
    </div>
  );
}
