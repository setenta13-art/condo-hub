import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ArrowRight, CheckCircle2, FileText, LockKeyhole, Megaphone, UserRoundPlus } from "lucide-react";
import { Link } from "wouter";

const features = [
  { icon: Megaphone, title: "Comunicação oficial", text: "Avisos importantes em um canal organizado, sem depender de grupos de WhatsApp." },
  { icon: CheckCircle2, title: "Chamados rastreáveis", text: "Registre solicitações, acompanhe o status e mantenha todo o histórico." },
  { icon: FileText, title: "Documentos acessíveis", text: "Regulamentos, atas e informações do condomínio sempre à mão." },
];

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><LockKeyhole className="h-5 w-5" /></div><div><p className="font-extrabold tracking-tight">CondoHub</p><p className="text-[11px] font-medium text-muted-foreground">Gestão que aproxima</p></div></div>
        <Button onClick={() => startLogin()} className="rounded-xl">Entrar</Button>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div><p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-primary">Seu condomínio, mais simples</p><h1 className="max-w-2xl text-4xl font-extrabold tracking-[-0.055em] sm:text-6xl">Tudo o que importa, em um só lugar.</h1><p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">O CondoHub aproxima moradores, administração e equipes em uma experiência clara, segura e organizada.</p><div className="mt-8 flex flex-wrap gap-3"><Button onClick={() => startLogin()} size="lg" className="rounded-xl px-5">Acessar minha conta <ArrowRight className="ml-2 h-4 w-4" /></Button><Link href="/invite"><Button variant="outline" size="lg" className="rounded-xl bg-background"><UserRoundPlus className="mr-2 h-4 w-4" />Tenho um convite</Button></Link></div><p className="mt-4 text-xs text-muted-foreground">O acesso ao ambiente do condomínio depende de cadastro e vínculo com uma unidade.</p></div>
          <div className="relative overflow-hidden rounded-[28px] bg-[#152e3b] p-7 text-white shadow-[0_25px_70px_-30px_rgba(20,44,57,0.65)] sm:p-9"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-[#b5dfd3]/10" /><p className="relative text-xs font-bold uppercase tracking-[0.16em] text-[#b5dfd3]">Uma nova rotina</p><h2 className="relative mt-5 text-3xl font-extrabold tracking-[-0.05em]">Mais clareza. Menos ruído.</h2><div className="relative mt-8 space-y-4">{["Avisos com histórico", "Chamados com acompanhamento", "Documentos centralizados"].map(item => <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.08] px-4 py-3 text-sm"><CheckCircle2 className="h-4 w-4 text-[#b5dfd3]" />{item}</div>)}</div></div>
        </section>
        <section className="mt-20 grid gap-4 md:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-border/80 bg-card p-6 shadow-[0_8px_28px_-24px_rgba(20,40,70,0.4)]"><div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-[18px] w-[18px]" /></div><h3 className="font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</section>
      </main>
    </div>
  );
}
