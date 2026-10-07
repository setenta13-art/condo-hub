import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ClipboardList, Clock3, Loader2, MessageSquare, Plus, RotateCcw, Send, ShieldCheck, UserRound, Wrench, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

const categories: Record<string, string> = { maintenance: "Manutenção", security: "Segurança", cleaning: "Limpeza", billing: "Financeiro", other: "Outro" };
const statuses: Record<string, string> = { open: "Reaberto", assigned: "Atribuído", in_progress: "Em atendimento", waiting: "Aguardando morador", resolved: "Concluído", closed: "Encerrado" };
const priorities: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };
type TicketStatus = "open" | "assigned" | "in_progress" | "waiting" | "resolved" | "closed";
type Category = "maintenance" | "security" | "cleaning" | "billing" | "other";
type Priority = "low" | "medium" | "high";

function formatDate(value: Date | string | undefined) {
  return value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value)) : "Agora";
}
function formatDateTime(value: Date | string | undefined) {
  return value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";
}

const emptyForm = {
  title: "",
  description: "",
  category: "maintenance" as Category,
  priority: "medium" as Priority,
  assignedToId: 0,
  general: false,
  block: "",
  unit: "",
};

export default function Tickets() {
  const { isAuthenticated } = useAuth();
  const { data: overview } = trpc.condo.dashboard.overview.useQuery(undefined, { enabled: isAuthenticated });
  const { data } = trpc.condo.tickets.list.useQuery(undefined, { enabled: isAuthenticated && !!overview?.scope });
  const { data: options } = trpc.condo.tickets.options.useQuery(undefined, { enabled: isAuthenticated && !!overview?.scope });
  const utils = trpc.useUtils();

  const [filter, setFilter] = useState("all");
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const detail = trpc.condo.tickets.detail.useQuery({ id: selectedId ?? 0 }, { enabled: selectedId != null });
  const create = trpc.condo.tickets.create.useMutation({
    onSuccess: async result => {
      await utils.condo.tickets.list.invalidate();
      await utils.condo.dashboard.overview.invalidate();
      await utils.condo.notifications.unreadCount.invalidate();
      setForm(emptyForm);
      setSubmitted(true);
      setShowForm(false);
      setSelectedId(result.ticketId);
    },
  });
  const updateStatus = trpc.condo.tickets.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.condo.tickets.list.invalidate();
      await utils.condo.dashboard.overview.invalidate();
      if (selectedId) await utils.condo.tickets.detail.invalidate({ id: selectedId });
      await utils.condo.notifications.unreadCount.invalidate();
    },
  });
  const assign = trpc.condo.tickets.assign.useMutation({
    onSuccess: async () => {
      await utils.condo.tickets.list.invalidate();
      if (selectedId) await utils.condo.tickets.detail.invalidate({ id: selectedId });
      await utils.condo.notifications.unreadCount.invalidate();
    },
  });
  const addMessage = trpc.condo.tickets.addMessage.useMutation({
    onSuccess: async () => {
      if (selectedId) await utils.condo.tickets.detail.invalidate({ id: selectedId });
      await utils.condo.notifications.unreadCount.invalidate();
      setMessage("");
    },
  });

  const tickets = data ?? [];
  const isStaff = overview?.scope?.isStaff ?? false;
  const filtered = filter === "all" ? tickets : tickets.filter(ticket => ticket.status === filter);
  const responsibleById = useMemo(() => new Map((options?.responsibles ?? []).map(row => [row.id, row])), [options?.responsibles]);
  const filteredUnits = (options?.units ?? []).filter(unit => {
    if (!form.block) return true;
    const block = options?.blocks.find(row => row.name === form.block);
    return block ? unit.blockId === block.id : true;
  });
  const selected = detail.data?.ticket;

  function submitTicket(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(false);
    if (!isAuthenticated || !overview?.scope || !form.assignedToId) return;
    create.mutate(form);
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><ClipboardList className="h-3.5 w-3.5" /> Atendimento organizado</div>
          <h1 className="text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">Chamados</h1>
          <p className="mt-1 text-sm text-muted-foreground">Abra uma solicitação, converse com o responsável e acompanhe cada etapa.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl bg-[#e4f5e8] px-3 py-2 text-xs font-bold text-[#2b8b50] sm:flex"><ShieldCheck className="h-4 w-4" /> Histórico rastreável</div>
          {isAuthenticated && overview?.scope && (
            <Button onClick={() => setShowForm(value => !value)} className="rounded-xl">
              {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {showForm ? "Fechar" : "Abrir chamado"}
            </Button>
          )}
        </div>
      </header>

      {submitted && <div className="flex items-center gap-3 rounded-2xl border border-[#bfe8c9] bg-[#e4f5e8] px-4 py-3 text-sm text-[#287d47]"><CheckCircle2 className="h-4 w-4" /> Chamado registrado e o responsável foi notificado.</div>}

      {showForm && (
        <form onSubmit={submitTicket} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></div>
            <div><h2 className="font-extrabold">Abrir novo chamado</h2><p className="text-xs text-muted-foreground">Defina o responsável já na abertura para evitar solicitações sem dono.</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Assunto</span><input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Portão da garagem travando" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /></label>
            <label><span className="mb-1.5 block text-xs font-bold">Categoria</span><select value={form.category} onChange={event => setForm({ ...form, category: event.target.value as Category })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="maintenance">Manutenção</option><option value="security">Segurança</option><option value="cleaning">Limpeza</option><option value="billing">Financeiro</option><option value="other">Outro</option></select></label>
            <label><span className="mb-1.5 block text-xs font-bold">Prioridade</span><select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value as Priority })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label>
            <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Responsável</span><select required value={form.assignedToId || ""} onChange={event => setForm({ ...form, assignedToId: Number(event.target.value) })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="">Selecione quem ficará responsável</option>{options?.responsibles.map(person => <option key={person.id} value={person.id}>{person.name || person.email}{person.contexts.length ? ` · ${person.contexts.join(" / ")}` : ""}</option>)}</select></label>
            {isStaff && (
              <>
                <label className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm"><input type="checkbox" checked={form.general} onChange={event => setForm({ ...form, general: event.target.checked, block: "", unit: "" })} /> Chamado geral do condomínio</label>
                {!form.general && <label><span className="mb-1.5 block text-xs font-bold">Bloco</span><select value={form.block} onChange={event => setForm({ ...form, block: event.target.value, unit: "" })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="">Sem bloco</option>{options?.blocks.map(block => <option key={block.id} value={block.name}>{block.name}</option>)}</select></label>}
                {!form.general && <label><span className="mb-1.5 block text-xs font-bold">Unidade</span><select value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="">Sem unidade específica</option>{filteredUnits.map(unit => <option key={unit.id} value={unit.identifier}>{unit.identifier}</option>)}</select></label>}
              </>
            )}
            <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Descrição</span><textarea required value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Inclua local, horário e outros detalhes úteis..." className="min-h-[126px] w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary" /></label>
          </div>
          <div className="mt-5 flex justify-end"><Button type="submit" disabled={!form.assignedToId || create.isPending} className="rounded-xl">{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Registrar chamado</Button></div>
        </form>
      )}

      {!isAuthenticated ? (
        <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] p-6 text-center"><p className="text-sm font-bold">Entre para acessar os chamados do seu condomínio.</p><Button variant="outline" onClick={() => startLogin()} className="mt-3">Entrar</Button></div>
      ) : (
        <section className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Acompanhamento</p><h2 className="mt-1 text-lg font-extrabold tracking-[-0.03em]">{isStaff ? "Chamados do condomínio" : "Seus chamados"}</h2></div>
            <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              {[["all", "Todos"], ["assigned", "Atribuídos"], ["in_progress", "Em atendimento"], ["waiting", "Aguardando"], ["resolved", "Concluídos"], ["closed", "Encerrados"]].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${filter === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
            </div>
          </div>
          <div className="space-y-3">
            {filtered.map(ticket => {
              const responsible = ticket.assignedToId ? responsibleById.get(ticket.assignedToId) : null;
              return (
                <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className="block w-full rounded-xl border border-border/70 p-4 text-left transition hover:border-primary/40 hover:bg-muted/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${["resolved","closed"].includes(ticket.status) ? "bg-[#e4f5e8] text-[#2b8b50]" : ["in_progress","waiting"].includes(ticket.status) ? "bg-[#fff3d9] text-[#b77a20]" : "bg-[#eee8ff] text-[#7652c8]"}`}>
                        {["resolved","closed"].includes(ticket.status) ? <CheckCircle2 className="h-4 w-4" /> : ["in_progress","waiting"].includes(ticket.status) ? <Clock3 className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">{ticket.title}</h3>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{ticket.description}</p>
                        <p className="mt-2 text-[10px] font-semibold text-muted-foreground">
                          {ticket.unit ? `${ticket.block ? ticket.block + " · " : ""}Unidade ${ticket.unit}` : "Chamado geral"} · {categories[ticket.category]} · {formatDate(ticket.createdAt)}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-primary">Responsável: {responsible?.name || responsible?.email || "Não identificado"}</p>
                      </div>
                    </div>
                    <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">{statuses[ticket.status] ?? ticket.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && <div className="rounded-xl bg-muted/60 p-8 text-center text-sm text-muted-foreground">Nenhum chamado nesta etapa.</div>}
          <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Prioridade alta recebe atenção primeiro · <span className="font-bold text-foreground">{tickets.filter(ticket => ticket.priority === "high").length} alta(s)</span></div>
        </section>
      )}

      <Dialog open={selectedId != null} onOpenChange={open => { if (!open) { setSelectedId(null); setMessage(""); } }}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.title ?? "Detalhes do chamado"}</DialogTitle></DialogHeader>
          {detail.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : selected && detail.data ? (
            <div className="space-y-6">
              <div className="grid gap-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-2">
                <Info label="Status" value={statuses[selected.status] ?? selected.status} />
                <Info label="Prioridade" value={priorities[selected.priority]} />
                <Info label="Solicitante" value={detail.data.openedBy?.name || detail.data.openedBy?.email || "Não identificado"} />
                <Info label="Unidade" value={selected.unit ? `${selected.block ? selected.block + " · " : ""}Unidade ${selected.unit}` : "Geral do condomínio"} />
                <Info label="Responsável" value={detail.data.assignedTo?.name || detail.data.assignedTo?.email || "Não atribuído"} />
                <Info label="Aberto em" value={formatDateTime(selected.createdAt)} />
              </div>

              <div><h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Descrição</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.description}</p></div>

              {isStaff && (
                <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
                  <label><span className="mb-1.5 block text-xs font-bold">Responsável</span><select value={selected.assignedToId ?? ""} onChange={event => assign.mutate({ id: selected.id, assignedToId: Number(event.target.value) })} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">{options?.responsibles.map(person => <option key={person.id} value={person.id}>{person.name || person.email}</option>)}</select></label>
                  <label><span className="mb-1.5 block text-xs font-bold">Etapa</span><select value={selected.status} onChange={event => updateStatus.mutate({ id: selected.id, status: event.target.value as TicketStatus })} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="assigned">Atribuído</option><option value="in_progress">Em atendimento</option><option value="waiting">Aguardando morador</option><option value="resolved">Concluído</option><option value="closed">Encerrado</option></select></label>
                </div>
              )}
              {!isStaff && ["resolved","closed"].includes(selected.status) && (
                <Button variant="outline" onClick={() => updateStatus.mutate({ id: selected.id, status: "open" })}><RotateCcw className="mr-2 h-4 w-4" />Reabrir chamado</Button>
              )}

              <div>
                <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-primary"><MessageSquare className="h-4 w-4" /> Conversa</h3>
                <div className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-2xl bg-muted/40 p-4">
                  {detail.data.messages.length ? detail.data.messages.map(item => (
                    <div key={item.id} className={`rounded-xl bg-background p-3 ${item.authorId === detail.data.openedBy?.id ? "" : "border-l-2 border-primary"}`}>
                      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold">{item.author?.name || item.author?.email || "Usuário"}</p><time className="text-[10px] text-muted-foreground">{formatDateTime(item.createdAt)}</time></div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-5">{item.body}</p>
                    </div>
                  )) : <p className="text-center text-xs text-muted-foreground">Nenhuma mensagem ainda.</p>}
                </div>
                <form onSubmit={event => { event.preventDefault(); if (message.trim()) addMessage.mutate({ id: selected.id, body: message.trim() }); }} className="mt-3 flex gap-2">
                  <input value={message} onChange={event => setMessage(event.target.value)} placeholder="Escreva uma mensagem..." className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                  <Button type="submit" disabled={!message.trim() || addMessage.isPending}>{addMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                </form>
              </div>

              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Histórico</h3>
                <div className="mt-3 space-y-3 border-l-2 border-muted pl-4">
                  {detail.data.events.map(event => (
                    <div key={event.id}>
                      <p className="text-xs font-bold">{eventLabel(event.eventType, event.toStatus, event.assignedTo?.name)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{event.actor?.name ? `${event.actor.name} · ` : ""}{formatDateTime(event.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Link href="/" className="inline-flex text-xs font-bold text-primary">← Voltar para a visão geral</Link>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

function eventLabel(type: string, status?: string | null, assignedName?: string | null) {
  if (type === "created") return assignedName ? `Chamado criado e atribuído a ${assignedName}` : "Chamado criado";
  if (type === "assigned") return assignedName ? `Responsável alterado para ${assignedName}` : "Responsável alterado";
  if (type === "message") return "Nova mensagem";
  if (type === "reopened") return "Chamado reaberto";
  if (type === "status_changed") return `Status alterado para ${status ? statuses[status] ?? status : "nova etapa"}`;
  return "Atualização no chamado";
}
