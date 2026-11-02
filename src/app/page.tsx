import Link from "next/link";
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
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { listUpcomingEvents } from "@/db/queries/events";
import { listRecentFinishedGames } from "@/db/queries/games";
import { SurfaceBadge } from "@/components/features/surface-badge";
import { TeamPill } from "@/components/features/team-card";
import { surfaceCover } from "@/lib/surface";
import { formatDateLong, formatTime } from "@/lib/time";

export default async function LandingPage() {
  const user = await getSessionUser();
  const settings = await getSettings();
  const upcoming = (await listUpcomingEvents()).filter((event) => event.publicToken).slice(0, 3);
  const recent = await listRecentFinishedGames(4);
  const logoUrl = settings.logoData
    ? `/api/logo?v=${settings.logoUpdatedAt?.getTime() ?? 0}`
    : settings.logoUrl;

  const features = [
    {
      icon: ClipboardCheck,
      title: "Lista de presença",
      text: "Confirme quem vai jogar e veja as vagas. Se lotar, a lista de espera entra sozinha.",
    },
    {
      icon: Shuffle,
      title: "Montagem dos times",
      text: "Os times são sorteados e equilibrados. Quem não joga agora fica na fila da próxima.",
    },
    {
      icon: Trophy,
      title: "Placar",
      text: "Anote o placar, encerre a partida e consulte os jogos anteriores.",
    },
    {
      icon: BarChart3,
      title: "Ranking",
      text: "Vitórias, aproveitamento e pontos do mês e da temporada.",
    },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand/25 blur-[80px]" />
        <div className="absolute -right-32 top-24 h-[380px] w-[380px] rounded-full bg-[#38bdf8]/12 blur-[75px]" />
        <svg
          className="absolute -right-24 bottom-0 h-[420px] w-[420px] text-ink/[0.04]"
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
            logoUrl={logoUrl}
            href="/"
          />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link href="/inicio" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
                Meu painel
              </Link>
            ) : (
              <>
                <Link href="/entrar" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className={cn(buttonVariants({ variant: "primary", size: "sm" }), "hidden sm:inline-flex")}
                >
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-16">
          <div className="max-w-3xl animate-[rise_0.5s_ease-out_both]">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Vôlei do grupo
            </span>
            <h1 className="mt-5 font-display text-5xl font-bold uppercase leading-[0.92] tracking-tight text-ink sm:text-7xl">
              Seu grupo de vôlei
              <span className="block text-brand">fora da bagunça</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              A lista de presença, os times e o placar ficam aqui. Dá para usar no celular antes do jogo
              e deixar todo mundo na mesma página.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={user ? "/inicio" : "/cadastro"}
                className={cn(buttonVariants({ size: "lg" }), "shine")}
              >
                {user ? "Ir para o painel" : "Começar agora"}
              </Link>
              <Link
                href={user ? "/jogos" : "/entrar"}
                className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
              >
                {user ? "Ver próximos jogos" : "Já tenho conta"}
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-3 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
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
              <CalendarDays className="h-5 w-5 text-brand" aria-hidden />
              <p className="text-sm text-muted">Próximo jogo com data, local e vagas</p>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-brand" aria-hidden />
              <p className="text-sm text-muted">Uma conta para cada jogador</p>
            </div>
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-brand" aria-hidden />
              <p className="text-sm text-muted">Ranking e resultados atualizados a cada jogo</p>
            </div>
          </div>
          {upcoming.length > 0 ? (
            <section className="mt-10 space-y-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Agenda</p>
                  <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
                    Próximas partidas
                  </h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {upcoming.map((event) => (
                  <Link
                    key={event.id}
                    href={`/e/${event.publicToken}`}
                    className="card overflow-hidden transition hover:border-brand/40"
                  >
                    <div className="relative h-24 bg-gradient-to-br from-brand/30 to-[#38bdf8]/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          event.coverMime
                            ? `/api/event-cover/${event.id}?v=${event.coverUpdatedAt?.getTime() ?? 0}`
                            : surfaceCover(event.surface)
                        }
                        alt=""
                        className={cn(
                          "h-full w-full object-cover",
                          event.coverMime ? "" : "opacity-80",
                        )}
                      />
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">
                        {event.title}
                      </p>
                      <p className="text-[11px] text-muted">
                        {formatDateLong(event.startsAt, settings.timezone)} ·{" "}
                        {formatTime(event.startsAt, settings.timezone)}
                      </p>
                      <p className="text-[11px] text-muted">{event.venueName}</p>
                      <div className="flex items-center justify-between gap-2">
                        <SurfaceBadge surface={event.surface} />
                        <p className="text-[11px] font-semibold text-success">
                          {Math.max(event.maxPlayers - event.confirmedCount, 0)} vaga(s)
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {recent.length > 0 ? (
            <section className="mt-10 space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Histórico</p>
                <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
                  Últimos resultados
                </h2>
              </div>
              <div className="space-y-2">
                {recent.map((game) => (
                  <div
                    key={game.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-surface-2/40 px-3 py-2 text-sm"
                  >
                    <TeamPill name={game.teamAName} color={game.teamAColor} />
                    <span className="font-display text-lg tabular-nums text-ink">
                      {game.scoreA} × {game.scoreB}
                    </span>
                    <TeamPill name={game.teamBName} color={game.teamBColor} />
                    <span className="ml-auto text-xs text-muted">{game.eventTitle}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10 grid gap-3 rounded-2xl border border-line bg-surface/60 p-5 text-sm leading-relaxed text-muted sm:grid-cols-2">
            <div>
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
                Sobre o grupo
              </h2>
              <p className="mt-2 whitespace-pre-line">
                {settings.aboutText?.trim() ||
                  "Grupo de amigos que joga vôlei toda semana. A ideia é jogar, se divertir e não perder tempo organizando lista."}
              </p>
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
                Regras e contato
              </h2>
              <p className="mt-2 whitespace-pre-line">
                {settings.rulesText?.trim() ||
                  "Confirme presença pelo site. Os times são montados automaticamente e quem chega depois entra na fila. Avise se não puder ir."}
              </p>
              {settings.contactText ? (
                <p className="mt-2 whitespace-pre-line">{settings.contactText}</p>
              ) : null}
            </div>
          </section>        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-xs text-muted">
          <p>
            {settings.siteName} · {settings.tagline}
          </p>
          <p>Bom jogo.</p>
        </footer>
      </div>
    </div>
  );
}
