import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Archive, Bell, CalendarDays, ChevronRight, Loader2, Megaphone, Pencil, Pin, Plus, Send, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

const labels: Record<string, string> = { maintenance: "Manutenção", finance: "Financeiro", event: "Evento", general: "Geral" };
type Category = "maintenance" | "finance" | "event" | "general";
const emptyForm = { title: "", summary: "", body: "", category: "general" as Category, isPinned: false };

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}
function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function Announcements() {
  const { isAuthenticated } = useAuth();
  const { data: overview } = trpc.condo.dashboard.overview.useQuery(undefined, { enabled: isAuthenticated });
  const { data } = trpc.condo.announcements.list.useQuery(undefined, { enabled: isAuthenticated && !!overview?.scope });
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);

  const detail = trpc.condo.announcements.detail.useQuery(
    { id: selectedId ?? 0 },
    { enabled: selectedId != null },
  );
  const create = trpc.condo.announcements.create.useMutation({
    onSuccess: async () => {
      await utils.condo.announcements.list.invalidate();
      await utils.condo.dashboard.overview.invalidate();
      setShowForm(false);
      setForm(emptyForm);
    },
  });
  const markRead = trpc.condo.announcements.markRead.useMutation({
    onSuccess: () => selectedId && utils.condo.announcements.detail.invalidate({ id: selectedId }),
  });
  const update = trpc.condo.announcements.update.useMutation({
    onSuccess: async () => {
      await utils.condo.announcements.list.invalidate();
      if (selectedId) await utils.condo.announcements.detail.invalidate({ id: selectedId });
      await utils.condo.dashboard.overview.invalidate();
      setEditing(false);
    },
  });
  const archive = trpc.condo.announcements.archive.useMutation({
    onSuccess: async () => {
      await utils.condo.announcements.list.invalidate();
      await utils.condo.dashboard.overview.invalidate();
      setSelectedId(null);
      setEditing(false);
    },
  });

  const announcements = data ?? [];
  const isStaff = overview?.scope?.isStaff ?? false;
  const filtered = filter === "all" ? announcements : announcements.filter(item => item.category === filter);
  const selected = detail.data?.announcement;

  useEffect(() => {
    if (!selected) return;
    setEditForm({
      title: selected.title,
      summary: selected.summary,
      body: selected.body,
      category: selected.category as Category,
      isPinned: selected.isPinned,
    });
  }, [selected]);

  function openAnnouncement(id: number) {
    setSelectedId(id);
    setEditing(false);
    if (isAuthenticated) markRead.mutate({ id });
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Megaphone className="h-3.5 w-3.5" /> Comunicação oficial</div>
          <h1 className="text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">Comunicados</h1>
          <p className="mt-1 text-sm text-muted-foreground">Informação clara, no momento certo e para as pessoas certas.</p>
        </div>
        {isStaff ? (
          <Button onClick={() => setShowForm(value => !value)} className="rounded-xl">
            {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {showForm ? "Fechar" : "Novo comunicado"}
          </Button>
        ) : (
          <div className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">Canal oficial do condomínio</div>
        )}
      </header>

      {showForm && (
        <form onSubmit={event => { event.preventDefault(); create.mutate(form); }} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Send className="h-4 w-4" /></div>
            <div><h2 className="font-extrabold">Publicar comunicado</h2><p className="text-xs text-muted-foreground">O aviso ficará disponível para os moradores do condomínio ativo.</p></div>
          </div>
          <AnnouncementFields form={form} setForm={setForm} />
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={create.isPending} className="rounded-xl">
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publicar agora
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {[["all", "Todos"], ["maintenance", "Manutenção"], ["event", "Eventos"], ["finance", "Financeiro"]].map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-xs font-bold transition ${filter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>{label}</button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((announcement, index) => (
          <button key={announcement.id} onClick={() => openAnnouncement(announcement.id)} className="group block w-full rounded-2xl border border-border/80 bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_14px_30px_-24px_rgba(20,50,70,0.5)] sm:p-6">
            <div className="flex gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${index % 3 === 0 ? "bg-[#dff5ef] text-[#18796c]" : index % 3 === 1 ? "bg-[#eee8ff] text-[#7652c8]" : "bg-[#fff3d9] text-[#b77a20]"}`}>
                {index % 3 === 0 ? <Wrench className="h-[18px] w-[18px]" /> : index % 3 === 1 ? <Bell className="h-[18px] w-[18px]" /> : <CalendarDays className="h-[18px] w-[18px]" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">{labels[announcement.category]}</span>
                  {announcement.isPinned && <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground"><Pin className="h-2.5 w-2.5" /> Fixado</span>}
                </div>
                <h2 className="mt-1.5 text-base font-extrabold tracking-[-0.02em] sm:text-lg">{announcement.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{announcement.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-medium text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Publicado em {formatDate(announcement.publishedAt)}</span>
                  {new Date(announcement.updatedAt).getTime() - new Date(announcement.createdAt).getTime() > 1000 && <span>Editado em {formatDateTime(announcement.updatedAt)}</span>}
                </div>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-1 group-hover:text-primary" />
            </div>
          </button>
        ))}
      </div>

      {!isAuthenticated && (
        <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] p-5 text-center">
          <p className="text-sm font-bold">Quer acompanhar os comunicados do seu condomínio?</p>
          <Button variant="outline" onClick={() => startLogin()} className="mt-3 rounded-xl bg-background">Entrar na plataforma</Button>
        </div>
      )}

      <Dialog open={selectedId != null} onOpenChange={open => { if (!open) { setSelectedId(null); setEditing(false); } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar comunicado" : selected?.title ?? "Comunicado"}</DialogTitle>
          </DialogHeader>
          {detail.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : selected ? (
            editing ? (
              <form onSubmit={event => { event.preventDefault(); update.mutate({ id: selected.id, ...editForm }); }}>
                <AnnouncementFields form={editForm} setForm={setEditForm} />
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                  <Button type="submit" disabled={update.isPending}>{update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações</Button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold uppercase tracking-[0.12em] text-primary">{labels[selected.category]}</span>
                  {selected.isPinned && <span className="rounded-full bg-accent px-2 py-1 font-bold"><Pin className="mr-1 inline h-3 w-3" />Fixado</span>}
                </div>
                <p className="mt-4 text-sm font-semibold text-muted-foreground">{selected.summary}</p>
                <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-foreground">{selected.body}</div>
                <div className="mt-6 space-y-1 border-t pt-4 text-xs text-muted-foreground">
                  <p>Publicado em {formatDateTime(selected.publishedAt)}</p>
                  {new Date(selected.updatedAt).getTime() - new Date(selected.createdAt).getTime() > 1000 && <p>Editado em {formatDateTime(selected.updatedAt)}</p>}
                  {detail.data?.readAt && <p className="font-semibold text-primary">Lido em {formatDateTime(detail.data.readAt)}</p>}
                </div>
                {isStaff && (
                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                    <Button variant="outline" onClick={() => update.mutate({ id: selected.id, title: selected.title, summary: selected.summary, body: selected.body, category: selected.category as Category, isPinned: !selected.isPinned })}>
                      <Pin className="mr-2 h-4 w-4" />{selected.isPinned ? "Desafixar" : "Fixar"}
                    </Button>
                    <Button variant="destructive" onClick={() => archive.mutate({ id: selected.id })}><Archive className="mr-2 h-4 w-4" />Arquivar</Button>
                  </div>
                )}
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <Link href="/" className="inline-flex items-center text-xs font-bold text-primary">← Voltar para a visão geral</Link>
    </div>
  );
}

function AnnouncementFields({
  form,
  setForm,
}: {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Título</span><input required value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /></label>
      <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Resumo</span><input required value={form.summary} onChange={event => setForm(current => ({ ...current, summary: event.target.value }))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /></label>
      <label><span className="mb-1.5 block text-xs font-bold">Categoria</span><select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value as Category }))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="general">Geral</option><option value="maintenance">Manutenção</option><option value="finance">Financeiro</option><option value="event">Evento</option></select></label>
      <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={form.isPinned} onChange={event => setForm(current => ({ ...current, isPinned: event.target.checked }))} className="h-4 w-4" /> Fixar no topo</label>
      <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Mensagem completa</span><textarea required value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} className="min-h-[130px] w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary" /></label>
    </div>
  );
}
