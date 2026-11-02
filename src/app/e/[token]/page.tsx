import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Trophy, Users } from "lucide-react";
import { AttendanceControls } from "@/components/features/attendance-controls";
import { ShareAttendanceButton } from "@/components/features/share-attendance-button";
import { ShareEventButton } from "@/components/features/share-event-button";
import { SurfaceBadge } from "@/components/features/surface-badge";
import { TeamPill } from "@/components/features/team-card";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { listEventGames, listRecentFinishedGames } from "@/db/queries/games";
import { getEventByPublicToken, getEventRoster, listUpcomingEvents } from "@/db/queries/events";
import { getSessionUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { surfaceCover, surfaceLabel } from "@/lib/surface";
import { formatDateLong, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const settings = await getSettings();
  const event = await getEventByPublicToken(token);
  if (!event) notFound();

  const user = await getSessionUser();
  const roster = await getEventRoster(event.id);
  const mine =
    roster.confirmed.find((row) => row.userId === user?.id) ??
    roster.organizers.find((row) => row.userId === user?.id) ??
    roster.waitlist.find((row) => row.userId === user?.id) ??
    null;

  const [games, upcoming, recent] = await Promise.all([
    listEventGames(event.id),
    listUpcomingEvents(),
    listRecentFinishedGames(4),
  ]);
  const results = games.filter((game) => game.status === "FINISHED");
  const otherEvents = upcoming.filter((item) => item.id !== event.id).slice(0, 3);
  const logoUrl = settings.logoData
    ? `/api/logo?v=${settings.logoUpdatedAt?.getTime() ?? 0}`
    : settings.logoUrl;
  const isPast = event.status === "FINISHED" || event.status === "CANCELLED";
  const remaining = Math.max(event.maxPlayers - event.confirmedCount, 0);
  const full = remaining === 0;
  const confirmedNames = [...roster.confirmed, ...roster.organizers].map((row) => row.name);
  const confirmedOnlyNames = roster.confirmed.map((row) => row.name);
  const organizerNames = roster.organizers.map((row) => row.name);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <Brand siteName={settings.siteName} tagline={settings.tagline} logoUrl={logoUrl} href="/" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link href="/inicio" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                Meu painel
              </Link>
            ) : (
              <>
                <Link href="/entrar" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  Entrar
                </Link>
                <Link
                  href={`/cadastro?next=${encodeURIComponent(`/e/${token}`)}`}
                  className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
                >
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5">
        <div className="relative overflow-hidden rounded-3xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              event.coverMime
                ? `/api/event-cover/${event.id}?v=${event.coverUpdatedAt?.getTime() ?? 0}`
                : surfaceCover(event.surface)
            }
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-65 blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220]/80 via-[#0b1220]/60 to-[#102a5c]/70" aria-hidden />
          <div className="relative px-5 py-8 text-center sm:px-10 sm:py-12">
            <Badge tone={isPast ? "neutral" : "success"}>
              {isPast ? "Evento encerrado" : "Inscrições abertas"}
            </Badge>
            <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-none tracking-tight text-white sm:text-6xl">
              {event.title}
            </h1>
            <p className="mt-3 text-sm text-white/75">
              {formatDateLong(event.startsAt, settings.timezone)} ·{" "}
              {formatTime(event.startsAt, settings.timezone)}
              {event.endsAt ? ` às ${formatTime(event.endsAt, settings.timezone)}` : ""}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white/75">
              <MapPin className="h-4 w-4" aria-hidden />
              {event.venueName}
              {event.address ? ` · ${event.address}` : ""}
            </p>
            {event.surface ? (
              <div className="mt-2 flex justify-center">
                <SurfaceBadge surface={event.surface} />
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {!isPast ? (
                user ? (
                  <AttendanceControls
                    eventId={event.id}
                    status={mine?.status ?? null}
                    waitlistPosition={mine?.waitlistPosition ?? null}
                    isFull={full}
                    allowWaitlist={settings.allowWaitlist}
                    isOrganizer={Boolean(mine?.isOrganizer)}
                    size="lg"
                    block={false}
                  />
                ) : (
                  <>
                    <Link
                      href={`/entrar?next=${encodeURIComponent(`/e/${token}`)}`}
                      className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
                    >
                      Entrar para confirmar
                    </Link>
                    <Link
                      href={`/cadastro?next=${encodeURIComponent(`/e/${token}`)}`}
                      className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
                    >
                      Criar conta
                    </Link>
                  </>
                )
              ) : (
                <Link href="/" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
                  Ver próximos jogos
                </Link>
              )}
            </div>
            <div className="mt-4 flex justify-center">
              <ShareEventButton token={token} title={event.title} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardBody className="text-center">
              <p className="font-display text-3xl font-bold text-ink">
                {event.confirmedCount}/{event.maxPlayers}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-muted">confirmados</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <p className="font-display text-3xl font-bold text-ink">{full ? 0 : remaining}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted">vagas livres</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <p className="font-display text-3xl font-bold text-ink">{roster.waitlist.length}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted">na fila</p>
            </CardBody>
          </Card>
        </div>

        {event.notes ? (
          <Card>
            <CardBody className="text-sm leading-relaxed text-muted">{event.notes}</CardBody>
          </Card>
        ) : null}

        <Card>
          <CardBody className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-brand" aria-hidden />
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                Quem vai
              </h2>
              <Badge>{confirmedNames.length}</Badge>
              <div className="ml-auto">
                <ShareAttendanceButton
                  title={event.title}
                  dateLabel={`${formatDateLong(event.startsAt, settings.timezone)} · ${formatTime(event.startsAt, settings.timezone)}`}
                  venue={event.venueName}
                  surface={surfaceLabel(event.surface)}
                  token={event.publicToken}
                  confirmed={confirmedOnlyNames}
                  organizers={organizerNames}
                />
              </div>
            </div>
            {confirmedNames.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {confirmedNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-xs text-ink/90"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Ninguém confirmou ainda.</p>
            )}
          </CardBody>
        </Card>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-success" aria-hidden />
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
              Resultados deste evento
            </h2>
          </div>
          {results.length === 0 ? (
            <p className="text-sm text-muted">Ainda não há partidas encerradas neste evento.</p>
          ) : (
            <div className="space-y-2">
              {results.map((game) => (
                <div
                  key={game.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-surface-2/40 px-3 py-2 text-sm"
                >
                  <TeamPill name={game.teamAName} color={game.teamAColor} />
                  <span className="font-display text-lg tabular-nums text-ink">
                    {game.scoreA} × {game.scoreB}
                  </span>
                  <TeamPill name={game.teamBName} color={game.teamBColor} />
                  <span className="ml-auto text-xs text-muted">
                    venceu {game.winnerTeamId === game.teamAId ? game.teamAName : game.teamBName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
            Próximas partidas do grupo
          </h2>
          {otherEvents.length === 0 ? (
            <p className="text-sm text-muted">Nenhum outro jogo agendado.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {otherEvents.map((item) => (
                <Link
                  key={item.id}
                  href={`/e/${item.publicToken}`}
                  className="card overflow-hidden transition hover:border-brand/40"
                >
                  <div className="relative h-24 bg-gradient-to-br from-brand/30 to-[#38bdf8]/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        item.coverMime
                          ? `/api/event-cover/${item.id}?v=${item.coverUpdatedAt?.getTime() ?? 0}`
                          : surfaceCover(item.surface)
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-muted">
                      {formatDateLong(item.startsAt, settings.timezone)} ·{" "}
                      {formatTime(item.startsAt, settings.timezone)}
                    </p>
                    <p className="text-[11px] text-muted">{item.venueName}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
            Últimos resultados
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Ainda não há resultados.</p>
          ) : (
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
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-xs text-muted">
          <p>
            {settings.siteName} · {settings.tagline}
          </p>
          <Link href="/" className="font-semibold text-brand hover:text-ink">
            Ver todos os jogos
            <ArrowRight className="ml-1 inline h-3.5 w-3.5" aria-hidden />
          </Link>
        </footer>
      </main>
    </div>
  );
}
