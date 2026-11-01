import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect("/inicio");

  const settings = await getSettings();

  const features = [
    {
      icon: ClipboardCheck,
      title: "Presença sem enrolação",
      text: "Confirme, cancele e acompanhe as vagas em tempo real. Lista de espera automática.",
    },
    {
      icon: Shuffle,
      title: "Sorteio de times justo",
      text: "Times equilibrados sorteados de verdade, com fila para quem ficou de fora.",
    },
    {
      icon: Trophy,
      title: "Placar ao vivo",
      text: "Registre pontos, encerre a partida e mantenha o histórico completo do grupo.",
    },
    {
      icon: BarChart3,
      title: "Ranking do grupo",
      text: "Vitórias, aproveitamento e pontuação por mês e por temporada.",
    },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand/25 blur-[120px]" />
        <div className="absolute -right-32 top-24 h-[380px] w-[380px] rounded-full bg-[#38bdf8]/12 blur-[110px]" />
        <svg
          className="absolute -right-24 bottom-0 h-[420px] w-[420px] text-white/[0.04]"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="100" cy="100" r="78" />
          <path d="M100 22c34 32 44 55 44 78s-10 46-44 78" />
          <path d="M100 178c-34-32-44-55-44-78s10-46 44-78" />
          <path d="M24 86h152M24 114h152" />
        </svg>
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between gap-4 py-6">
          <Brand
            siteName={settings.siteName}
            tagline={settings.tagline}
            logoUrl={settings.logoUrl || "/logo.png"}
            href="/"
          />
          <div className="flex items-center gap-2">
            <Link href="/entrar" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className={cn(buttonVariants({ variant: "primary", size: "sm" }), "hidden sm:inline-flex")}
            >
              Criar conta
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-16">
          <div className="max-w-3xl animate-[rise_0.5s_ease-out_both]">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9db8ff]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Vôlei organizado, de verdade
            </span>
            <h1 className="mt-5 font-display text-5xl font-bold uppercase leading-[0.92] tracking-tight text-white sm:text-7xl">
              Seu grupo de vôlei
              <span className="block text-[#7fa2ff]">fora da bagunça</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Presenças, sorteio automático de times, placar ao vivo, histórico e ranking. Tudo em um só
              lugar — feito para abrir no celular antes do jogo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/cadastro" className={cn(buttonVariants({ size: "lg" }), "shine")}>
                Começar agora
              </Link>
              <Link
                href="/entrar"
                className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
              >
                Já tenho conta
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-3 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-[#9db8ff]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h2 className="mt-3 font-display text-lg font-semibold uppercase tracking-wide text-ink">
                    {feature.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{feature.text}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 grid gap-3 rounded-2xl border border-line bg-surface/60 p-4 sm:grid-cols-3 sm:p-5">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-[#7fa2ff]" aria-hidden />
              <p className="text-sm text-muted">Próximo jogo com data, local e vagas</p>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-[#7fa2ff]" aria-hidden />
              <p className="text-sm text-muted">Contas individuais para cada jogador</p>
            </div>
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-[#7fa2ff]" aria-hidden />
              <p className="text-sm text-muted">Resultados e ranking calculados sozinhos</p>
            </div>
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-xs text-muted">
          <p>
            {settings.siteName} · {settings.tagline}
          </p>
          <p>Feito para o nosso grupo de vôlei.</p>
        </footer>
      </div>
    </div>
  );
}
