import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock,
  MapPin,
  Megaphone,
  PenLine,
  Shuffle,
  Trophy,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getEventRoster, listOperationalEvents } from "@/db/queries/events";
import { listAnnouncements } from "@/db/queries/announcements";
import { listLiveGames } from "@/db/queries/games";
import { AttendanceControls } from "@/components/features/attendance-controls";
import { OrganizerToggle } from "@/components/features/organizer-toggle";
import { ShareEventButton } from "@/components/features/share-event-button";
import { AutoRefresh } from "@/components/features/auto-refresh";
import { GameDurationBadge } from "@/components/features/game-duration";
import { EventStatusBadge, GameStatusBadge } from "@/components/features/status-badge";
import { EventPriceBadge } from "@/components/features/event-price-badge";
import { SurfaceBadge } from "@/components/features/surface-badge";
import { TeamPill } from "@/components/features/team-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat";
import { cn, firstName, plural } from "@/lib/utils";
import { countdownLabel, dayParts, formatDateShort, formatDateTime, formatWeekday } from "@/lib/time";

export const metadata = { title: "Início" };

export default async function HomePage() {
  const user = await requireUser();
  const settings = await getSettings();
  const operationalEvents = await listOperationalEvents();
  const activeEvent = operationalEvents.find((event) => event.active) ?? null;
  const nextEvent = activeEvent ?? operationalEvents[0] ?? null;
  const roster = nextEvent ? await getEventRoster(nextEvent.id) : null;
  const announcements = await listAnnouncements(4);
  const liveGames = await listLiveGames();
  const liveGame = activeEvent
    ? (liveGames.find((game) => game.eventId === activeEvent.id) ?? liveGames[0] ?? null)
    : (liveGames[0] ?? null);
  const activeHours = activeEvent?.activeHours ?? 0;

  const confirmed = roster?.confirmed ?? [];
  const pendingPayment = roster?.pendingPayment ?? [];
  const organizers = roster?.organizers ?? [];
  const waitlist = roster?.waitlist ?? [];
  const pending = roster?.pending ?? [];
  const mine =
    confirmed.find((row) => row.userId === user.id) ??
    pendingPayment.find((row) => row.userId === user.id) ??
    organizers.find((row) => row.userId === user.id) ??
    waitlist.find((row) => row.userId === user.id) ??
    null;

  const reserved = confirmed.length + pendingPayment.length;
  const isFull = Boolean(nextEvent && reserved >= nextEvent.maxPlayers);
  const remaining = nextEvent ? Math.max(nextEvent.maxPlayers - reserved, 0) : 0;
  const capacityTone = isFull ? "success" : remaining <= 3 ? "warning" : "brand";
  const parts = nextEvent ? dayParts(nextEvent.startsAt, settings.timezone) : null;

  return (
    <div className="stagger space-y-5">
      <PageHeader
        eyebrow={`${formatWeekday(new Date(), settings.timezone)}, ${formatDateShort(new Date(), settings.timezone)}`}
        title={`E aí, ${firstName(user.name)}`}
        subtitle="Seu grupo de vôlei, pronto para o próximo jogo."
        action={
          nextEvent ? (
            <Link
              href={`/presencas?evento=${nextEvent.id}`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              <Users className="h-4 w-4" aria-hidden />
              Presenças
            </Link>
          ) : undefined
        }
      />

      {liveGame ? (
        <Card className="border-[rgba(240,82,82,0.35)]">
          <CardHeader className="items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <GameStatusBadge status="IN_PROGRESS" />
              <p className="min-w-0 text-sm leading-tight text-muted">
                <span className="block text-[10px] uppercase tracking-wider">Partida em andamento</span>
                <span className="block truncate font-semibold text-ink">{liveGame.eventTitle}</span>
              </p>
            </div>
            <AutoRefresh intervalMs={15000} />
            <Link
              href={`/racha?evento=${liveGame.eventId}`}
              className="shrink-0 whitespace-nowrap text-xs font-semibold text-brand hover:text-ink"
            >
              Abrir racha
            </Link>
          </CardHeader>
          <CardBody className="space-y-2">
            <div className="flex items-center justify-center gap-4">
              <div className="min-w-0 flex-1 text-right">
                <TeamPill name={liveGame.teamAName} color={liveGame.teamAColor} />
              </div>
              <p className="font-display text-4xl font-bold tabular-nums text-ink">
                {liveGame.scoreA}
                <span className="mx-2 text-muted/50">:</span>
                {liveGame.scoreB}
              </p>
              <div className="min-w-0 flex-1">
                <TeamPill name={liveGame.teamBName} color={liveGame.teamBColor} />
              </div>
            </div>
            <div className="flex justify-center">
              <GameDurationBadge
                startedAt={liveGame.startedAt}
                finishedAt={liveGame.finishedAt}
                live
              />
            </div>
            {activeHours >= 6 ? (
              <p className="text-center text-[11px] uppercase tracking-wider text-warning">
                Sessão aberta há {activeHours}h · finalize ou encerre no racha
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {nextEvent && roster && parts ? (
        <Card>
          <div className="home-glow pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/20 blur-2xl" />
          <CardBody className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex min-w-[72px] flex-col items-center rounded-2xl border border-brand/25 bg-brand/10 px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand">
                    {parts.month}
                  </span>
                  <span className="font-display text-3xl font-bold leading-none text-ink">{parts.day}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {parts.weekday}
                  </span>
                </div>
                <div className="min-w-0">
                  <Badge tone={nextEvent.active ? "live" : "brand"} className="mb-1.5">
                    {nextEvent.active
                      ? "Em andamento"
                      : countdownLabel(nextEvent.startsAt, settings.timezone)}
                  </Badge>
                  <h2 className="font-display text-2xl font-semibold uppercase leading-tight tracking-wide text-ink">
                    {nextEvent.title}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {formatDateTime(nextEvent.startsAt, settings.timezone)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <SurfaceBadge surface={nextEvent.surface} />
                <EventPriceBadge paymentMode={nextEvent.paymentMode} priceCents={nextEvent.priceCents} />
                <EventStatusBadge status={nextEvent.status} />
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-line bg-surface-2/50 p-3">
              <p className="flex items-start gap-2 text-sm text-ink/90">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <span>
                  <span className="font-medium">{nextEvent.venueName}</span>
                  {nextEvent.address ? (
                    <span className="block text-xs text-muted">{nextEvent.address}</span>
                  ) : null}
                </span>
              </p>
              {nextEvent.notes ? <p className="text-xs text-muted">{nextEvent.notes}</p> : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-end justify-between gap-2">
                <p className="text-sm text-muted">
                  <strong className="font-display text-2xl text-ink">{confirmed.length}</strong>
                  <span className="text-muted">/{nextEvent.maxPlayers} confirmados</span>
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {isFull
                    ? `${waitlist.length} na fila`
                    : remaining === 1
                      ? "1 vaga restante"
                      : `${remaining} vagas restantes`}
                </p>
              </div>
              <Progress
                value={reserved}
                max={nextEvent.maxPlayers}
                tone={capacityTone}
                className="h-2.5"
              />
              {pendingPayment.length > 0 ? (
                <p className="text-[11px] text-warning">
                  {pendingPayment.length} aguardando aprovação do pagamento
                </p>
              ) : null}
            </div>

            {confirmed.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex -space-x-2">
                  {confirmed.slice(0, 8).map((player) => (
                    <Avatar
                      key={player.userId}
                      userId={player.userId}
                      name={player.name}
                      version={player.avatarUpdatedAt}
                      size="sm"
                      className="ring-2 ring-[#0d1526]"
                    />
                  ))}
                </div>
                <p className="text-xs text-muted">
                  {confirmed
                    .slice(0, 3)
                    .map((player) => firstName(player.name))
                    .join(", ")}
                  {confirmed.length > 3 ? ` e mais ${confirmed.length - 3}` : ""}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              {user.role === "ADMIN" ? (
                <OrganizerToggle
                  eventId={nextEvent.id}
                  attendanceId={mine?.attendanceId}
                  isOrganizer={Boolean(mine?.isOrganizer)}
                  isAdmin
                />
              ) : (
                <AttendanceControls
                  eventId={nextEvent.id}
                  status={mine?.status ?? null}
                  waitlistPosition={mine?.waitlistPosition ?? null}
                  isFull={isFull}
                  allowWaitlist={settings.allowWaitlist}
                  isOrganizer={organizers.some((row) => row.userId === user.id)}
                  attendanceId={mine?.attendanceId}
                  autoPaymentReview={nextEvent.autoPaymentReview}
                  requiresPayment={nextEvent.paymentMode === "PAID"}
                />
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
                <Link href={`/presencas?evento=${nextEvent.id}`} className="font-medium text-brand hover:text-ink">
                  Ver lista completa
                </Link>
                <Link href={`/racha?evento=${nextEvent.id}`} className="font-medium text-brand hover:text-ink">
                  Ir para o racha
                </Link>
                {nextEvent.publicToken ? (
                  <ShareEventButton token={nextEvent.publicToken} title={nextEvent.title} />
                ) : null}
                {user.role === "ADMIN" ? (
                  <Link href={`/admin/eventos?edit=${nextEvent.id}#edit-${nextEvent.id}`} className="inline-flex items-center gap-1 font-medium text-muted hover:text-ink">
                    <PenLine className="h-3 w-3" aria-hidden />
                    Editar evento
                  </Link>
                ) : null}
              </div>
            </div>
          </CardBody>

          {(pending.length > 0 || waitlist.length > 0) && (
            <div className="border-t border-line px-4 py-3 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                    Ainda não confirmaram · {pending.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pending.slice(0, 10).map((player) => (
                      <span
                        key={player.userId}
                        className="rounded-full border border-line bg-surface-2/60 px-2 py-0.5 text-[11px] text-muted"
                      >
                        {firstName(player.name)}
                      </span>
                    ))}
                    {pending.length > 10 ? (
                      <span className="text-[11px] text-muted">+{pending.length - 10}</span>
                    ) : null}
                    {pending.length === 0 ? <span className="text-[11px] text-muted">Todos responderam 🎉</span> : null}
                  </div>
                </div>
                {waitlist.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                      Fila de espera · {waitlist.length}
                    </p>
                    <ol className="flex flex-wrap gap-1.5">
                      {waitlist.map((player) => (
                        <li
                          key={player.userId}
                          className="rounded-full border border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.08)] px-2 py-0.5 text-[11px] text-warning"
                        >
                          {player.waitlistPosition}º {firstName(player.name)}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Nenhum jogo agendado"
          description={
            user.role === "ADMIN"
              ? "Crie o próximo evento para o grupo confirmar presença."
              : "Assim que o administrador criar o próximo evento, ele aparece aqui."
          }
          action={
            user.role === "ADMIN" ? (
              <Link href="/admin/eventos" className={cn(buttonVariants({ size: "md" }))}>
                Criar evento
              </Link>
            ) : undefined
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Confirmados"
          value={confirmed.length}
          hint={nextEvent ? nextEvent.title : "Sem jogo agendado"}
          icon={<Users className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Vagas livres"
          value={nextEvent ? remaining : "—"}
          hint={waitlist.length > 0 ? `${waitlist.length} na fila` : "Lista de espera vazia"}
          icon={<CalendarDays className="h-4 w-4" />}
          accent={nextEvent && remaining <= 3 ? "warning" : "success"}
        />
        <StatCard
          label="Avisos"
          value={announcements.length}
          hint="Comunicados do grupo"
          icon={<Megaphone className="h-4 w-4" />}
          accent="neutral"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/racha" className="card group flex items-center gap-3 p-4 transition hover:border-brand/40">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Shuffle className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-semibold uppercase tracking-wide text-ink">
              Abrir racha
            </span>
            <span className="block text-xs text-muted">Partida, placar e fila automáticos</span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted transition group-hover:text-ink" aria-hidden />
        </Link>
        <Link href="/partidas" className="card group flex items-center gap-3 p-4 transition hover:border-brand/40">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(34,197,94,0.12)] text-success">
            <Trophy className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-semibold uppercase tracking-wide text-ink">
              Placar
            </span>
            <span className="block text-xs text-muted">Registre pontos ao vivo</span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted transition group-hover:text-ink" aria-hidden />
        </Link>
        {settings.rankingEnabled ? (
          <Link href="/ranking" className="card group flex items-center gap-3 p-4 transition hover:border-brand/40">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(245,185,66,0.12)] text-warning">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-semibold uppercase tracking-wide text-ink">
                Ranking
              </span>
              <span className="block text-xs text-muted">Quem está voando na temporada</span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted transition group-hover:text-ink" aria-hidden />
          </Link>
        ) : null}
      </div>

      <section>
        <SectionTitle
          title="Avisos"
          subtitle="Recados do administrador do grupo"
          action={
            user.role === "ADMIN" ? (
              <Link href="/admin/avisos" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                Publicar
              </Link>
            ) : undefined
          }
        />
        {announcements.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-5 w-5" />}
            title="Nenhum aviso publicado"
            description="Os avisos do grupo aparecem aqui."
          />
        ) : (
          <div className="space-y-2">
            {announcements.map((announcement) => (
              <Card key={announcement.id}>
                <CardHeader className="items-start pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{announcement.title}</CardTitle>
                      {announcement.pinned ? <Badge tone="warning">Fixado</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">
                      {formatDateShort(announcement.publishedAt, settings.timezone)}
                      {announcement.authorName ? ` · ${announcement.authorName}` : ""}
                    </p>
                  </div>
                </CardHeader>
                <CardBody className="pt-2">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink/85">{announcement.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <p className="pt-2 text-center text-[11px] uppercase tracking-[0.18em] text-muted/60">
        {plural(confirmed.length, "jogador confirmado", "jogadores confirmados")} · {settings.siteName}
      </p>
    </div>
  );
}
