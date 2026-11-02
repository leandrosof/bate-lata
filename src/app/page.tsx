import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Info,
  MapPin,
  MessageCircle,
  ScrollText,
  Shuffle,
  Trophy,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SurfaceBadge } from "@/components/features/surface-badge";
import { TeamPill } from "@/components/features/team-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { listFinishedPublicEvents, listUpcomingEvents, type EventSummary } from "@/db/queries/events";
import { listRecentFinishedGames } from "@/db/queries/games";
import { getSessionUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { surfaceCover } from "@/lib/surface";
import { formatDateLong, formatDateShort, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const AGENDA_PAGE_SIZE = 6;

function occupancyLabel(event: EventSummary, finished: boolean): string {
  if (finished) return "Encerrado";
  const remaining = Math.max(event.maxPlayers - event.confirmedCount, 0);
  if (remaining === 0) return "Lotado";
  return `${remaining} vaga${remaining === 1 ? "" : "s"}`;
}

function EventCover({ event }: { event: EventSummary }) {
  return (
    <div className="relative h-36 overflow-hidden sm:h-40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          event.coverMime
            ? `/api/event-cover/${event.id}?v=${event.coverUpdatedAt?.getTime() ?? 0}`
            : surfaceCover(event.surface)
        }
        alt=""
        className={cn("h-full w-full object-cover", event.coverMime ? "" : "opacity-85")}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30" aria-hidden />
    </div>
  );
}

function AgendaCard({
  event,
  timeZone,
  finished,
}: {
  event: EventSummary;
  timeZone: string;
  finished: boolean;
}) {
  const remaining = Math.max(event.maxPlayers - event.confirmedCount, 0);
  const badgeLabel = occupancyLabel(event, finished);
  const zeroConfirmed = !finished && event.confirmedCount === 0;

  return (
    <article className="card overflow-hidden transition hover:border-brand/40">
      <Link
        href={`/e/${event.publicToken}`}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <div className="relative">
          <EventCover event={event} />
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <SurfaceBadge surface={event.surface} onDark />
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md",
                finished ? "bg-slate-700/85" : remaining === 0 ? "bg-rose-600/90" : "bg-emerald-600/90",
              )}
            >
              {badgeLabel}
            </span>
          </div>
        </div>

        <div className="space-y-2.5 p-4">
          <h3 className="truncate font-display text-lg font-semibold uppercase tracking-wide text-ink">
            {event.title}
          </h3>
          <div className="space-y-1 text-xs text-muted">
            <p className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{formatDateLong(event.startsAt, timeZone)}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{formatTime(event.startsAt, timeZone)}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{event.venueName}</span>
            </p>
          </div>

          {zeroConfirmed ? (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-success">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Inscrições abertas
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 transition group-hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:group-hover:bg-blue-900/70">
                Confirmar presença
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
          ) : (
            <>
              <Progress
                value={event.confirmedCount}
                max={event.maxPlayers}
                tone={finished ? "success" : remaining === 0 ? "danger" : remaining <= 3 ? "warning" : "brand"}
              />
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-ink">
                  {event.confirmedCount}/{event.maxPlayers} confirmados
                </span>
                <span className={cn("font-semibold", finished ? "text-muted" : "text-brand")}>
                  {finished ? "Ver evento" : remaining === 0 ? "Lista de espera" : "Ver evento"}
                </span>
              </div>
            </>
          )}
        </div>
      </Link>
    </article>
  );
}

function NextEventCard({ event, timeZone }: { event: EventSummary; timeZone: string }) {
  const remaining = Math.max(event.maxPlayers - event.confirmedCount, 0);

  return (
    <article className="relative flex min-h-[340px] flex-col justify-end overflow-hidden rounded-3xl border border-white/10 bg-slate-900 text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          event.coverMime
            ? `/api/event-cover/${event.id}?v=${event.coverUpdatedAt?.getTime() ?? 0}`
            : surfaceCover(event.surface)
        }
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent" aria-hidden />

      <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-2 sm:inset-x-5 sm:top-5">
        <SurfaceBadge surface={event.surface} onDark />
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md",
            remaining === 0 ? "bg-rose-600/90" : "bg-emerald-600/90",
          )}
        >
          {remaining === 0 ? "Lotado" : `${remaining} vaga${remaining === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="relative z-10 space-y-3 p-5 pt-20 sm:p-6 sm:pt-24">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Próximo jogo</p>
          <h2 className="mt-1 font-display text-3xl font-semibold uppercase leading-tight tracking-wide text-white sm:text-4xl">
            {event.title}
          </h2>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            {formatDateLong(event.startsAt, timeZone)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            {formatTime(event.startsAt, timeZone)}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-white/85">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {event.venueName}
        </p>

        <Progress
          value={event.confirmedCount}
          max={event.maxPlayers}
          tone={remaining === 0 ? "danger" : remaining <= 3 ? "warning" : "brand"}
          className="bg-white/20"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white">
            {event.confirmedCount}/{event.maxPlayers} confirmados
          </span>
          <span className={cn("font-semibold", remaining === 0 ? "text-rose-300" : "text-emerald-300")}>
            {remaining === 0 ? "Lotado" : `${remaining} vagas`}
          </span>
        </div>

        <Link
          href={`/e/${event.publicToken}`}
          className={cn(buttonVariants({ variant: "white", size: "lg" }), "min-h-[44px] w-full")}
        >
          Ver evento e confirmar
          <ArrowRightIcon />
        </Link>
      </div>
    </article>
  );
}

function ArrowRightIcon() {
  return <ChevronRight className="h-4 w-4" aria-hidden />;
}

function ScoreboardCard({ game, timeZone }: { game: Awaited<ReturnType<typeof listRecentFinishedGames>>[number]; timeZone: string }) {
  return (
    <article className="card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted">
        <span className="truncate">{game.eventTitle}</span>
        <span className="shrink-0">{formatDateShort(game.eventStartsAt, timeZone)}</span>
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="flex min-w-0 justify-start overflow-hidden">
          <TeamPill name={game.teamAName} color={game.teamAColor} className="max-w-full" />
        </div>
        <span className="whitespace-nowrap rounded-lg bg-ink/5 px-2.5 py-1 font-mono text-base font-bold tabular-nums text-ink">
          {game.scoreA} × {game.scoreB}
        </span>
        <div className="flex min-w-0 justify-end overflow-hidden">
          <TeamPill name={game.teamBName} color={game.teamBColor} className="max-w-full" />
        </div>
      </div>
    </article>
  );
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  const settings = await getSettings();
  const params = await searchParams;
  const allUpcoming = (await listUpcomingEvents()).filter((event) => event.publicToken);
  const allFinished = await listFinishedPublicEvents();
  const nextEvent =
    allUpcoming.find((event) => event.maxPlayers > event.confirmedCount) ?? allUpcoming[0] ?? null;
  const upcomingAgenda =
    allUpcoming.length > 1 && nextEvent
      ? allUpcoming.filter((event) => event.id !== nextEvent.id)
      : allUpcoming;
  const agendaMode = params.agenda === "encerrados" ? "finished" : "upcoming";
  const agendaEvents = agendaMode === "finished" ? allFinished : upcomingAgenda;
  const totalPages = Math.max(1, Math.ceil(agendaEvents.length / AGENDA_PAGE_SIZE));
  const requestedPage = Number(typeof params.pagina === "string" ? params.pagina : "1");
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(Math.trunc(requestedPage), 1), totalPages)
    : 1;
  const pageEvents = agendaEvents.slice((page - 1) * AGENDA_PAGE_SIZE, page * AGENDA_PAGE_SIZE);
  const agendaHref = (nextPage: number) =>
    `/?agenda=${agendaMode === "finished" ? "encerrados" : "proximos"}&pagina=${nextPage}#agenda`;
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
    <div className="relative min-h-dvh overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand/25 blur-[80px]" />
        <div className="absolute -right-32 top-24 h-[380px] w-[380px] rounded-full bg-[#38bdf8]/12 blur-[75px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-line bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <Brand
            compact
            siteName={settings.siteName}
            tagline={settings.tagline}
            logoUrl={logoUrl}
            href="/"
          />
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link
                href="/inicio"
                className={cn(buttonVariants({ variant: "primary", size: "sm" }), "min-h-[44px]")}
              >
                Meu painel
              </Link>
            ) : (
              <>
                <Link
                  href="/entrar"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden min-h-[44px] sm:inline-flex")}
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className={cn(buttonVariants({ variant: "primary", size: "sm" }), "min-h-[44px]")}
                >
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6">
        <section className="grid gap-6 py-6 sm:py-10 lg:grid-cols-12 lg:items-center lg:gap-8">
          <div className="animate-[rise_0.5s_ease-out_both] lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
              🏐 SEU ANTISTRESS DE TODA SEMANA
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              ONDE A GENTE ENCONTRA
              <span className="block text-brand">O VÔLEI E A RESENHA</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Chega de dor de cabeça organizando jogo no WhatsApp. Confirme sua presença, deixe a montagem dos times com a gente e venha focar só na partida.
            </p>
          </div>

          <div className="lg:col-span-5">
            {nextEvent ? (
              <NextEventCard event={nextEvent} timeZone={settings.timezone} />
            ) : (
              <article className="card flex min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <CalendarDays className="h-6 w-6" aria-hidden />
                </span>
                <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
                  Nenhum jogo agendado
                </h2>
                <p className="max-w-xs text-sm text-muted">
                  Quando o próximo encontro for criado, ele aparece aqui.
                </p>
                <Link href="#agenda" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "min-h-[44px]")}>
                  Ver agenda
                </Link>
              </article>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 items-start gap-6 pb-10 lg:grid-cols-12 lg:gap-8">
          <div id="agenda" className="scroll-mt-24 lg:col-span-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Agenda</p>
                <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
                  {agendaMode === "finished" ? "Eventos encerrados" : "Próximas partidas"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Link
                  href="/?agenda=proximos#agenda"
                  className={cn(
                    buttonVariants({ variant: agendaMode === "upcoming" ? "primary" : "secondary", size: "sm" }),
                    "min-h-[44px]",
                  )}
                >
                  Próximos
                </Link>
                <Link
                  href="/?agenda=encerrados#agenda"
                  className={cn(
                    buttonVariants({ variant: agendaMode === "finished" ? "primary" : "secondary", size: "sm" }),
                    "min-h-[44px]",
                  )}
                >
                  Encerrados
                </Link>
                <span className="ml-1 text-xs text-muted">
                  {agendaEvents.length} {agendaEvents.length === 1 ? "evento" : "eventos"}
                </span>
              </div>
            </div>

            {pageEvents.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                {agendaMode === "finished"
                  ? "Nenhum evento encerrado ainda."
                  : "Nenhum jogo agendado no momento."}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pageEvents.map((event) => (
                  <AgendaCard
                    key={event.id}
                    event={event}
                    timeZone={settings.timezone}
                    finished={agendaMode === "finished"}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 ? (
              <nav className="mt-4 flex flex-wrap items-center justify-between gap-2" aria-label="Paginação da agenda">
                {page > 1 ? (
                  <Link
                    href={agendaHref(page - 1)}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "min-h-[44px]")}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Anterior
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "pointer-events-none min-h-[44px] opacity-40")}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Anterior
                  </span>
                )}
                <span className="text-xs font-medium text-muted">
                  Página {page} de {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={agendaHref(page + 1)}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "min-h-[44px]")}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "pointer-events-none min-h-[44px] opacity-40")}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </nav>
            ) : null}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24 lg:col-span-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Histórico</p>
                <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
                  Últimos resultados
                </h2>
              </div>
              <Badge tone="neutral">{recent.length}</Badge>
            </div>

            {recent.length > 0 ? (
              <div className="space-y-3">
                {recent.map((game) => (
                  <ScoreboardCard key={game.id} game={game} timeZone={settings.timezone} />
                ))}
              </div>
            ) : (
              <p className="card p-4 text-sm text-muted">Nenhum resultado registrado ainda.</p>
            )}
          </aside>
        </section>

        <section className="pb-10">
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Como funciona</p>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
              Simples para o grupo inteiro
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card p-3 sm:p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <h3 className="mt-3 font-display text-sm font-semibold uppercase tracking-wide text-ink sm:text-base">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{feature.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 pb-12 lg:grid-cols-2">
          <article className="card relative overflow-hidden border-l-4 border-l-brand p-5">
            <span
              className="pointer-events-none absolute -right-2 -top-6 font-display text-8xl leading-none text-brand/10"
              aria-hidden
            >
              “
            </span>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <Info className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
                  Sobre o grupo
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="brand">Jogo pegado</Badge>
                  <Badge tone="success">Amizade</Badge>
                  <Badge tone="warning">Resenha</Badge>
                </div>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted">
              {settings.aboutText?.trim() ||
                "Grupo de amigos que joga vôlei toda semana. A ideia é jogar, se divertir e não perder tempo organizando lista."}
            </p>
          </article>

          <article className="card relative overflow-hidden border-l-4 border-l-accent p-5">
            <span
              className="pointer-events-none absolute -right-3 -top-7 font-display text-8xl leading-none text-accent/10"
              aria-hidden
            >
              !
            </span>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <ScrollText className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
                  Regras e contato
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="brand">Respeito máximo</Badge>
                  <Badge tone="warning">Sem pressão</Badge>
                  <Badge tone="success">Diversão</Badge>
                </div>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted">
              {settings.rulesText?.trim() ||
                "Confirme presença pelo site. Os times são montados automaticamente e quem chega depois entra na fila. Avise se não puder ir."}
            </p>
            {settings.contactText ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-muted">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <span className="whitespace-pre-line">{settings.contactText}</span>
              </div>
            ) : null}
          </article>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted sm:px-6">
          <p>
            {settings.siteName} · {settings.tagline}
          </p>
          <p>Bom jogo.</p>
        </div>
      </footer>
    </div>
  );
}
