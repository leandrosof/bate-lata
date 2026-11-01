import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { AttendanceControls } from "@/components/features/attendance-controls";
import { OrganizerToggle } from "@/components/features/organizer-toggle";
import { EventCalendar } from "@/components/features/event-calendar";
import { ShareEventButton } from "@/components/features/share-event-button";
import { EventStatusBadge } from "@/components/features/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { getAttendanceMap, listOperationalEvents } from "@/db/queries/events";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { countdownLabel, dayParts, formatDateTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Próximos jogos" };

export default async function UpcomingPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const events = await listOperationalEvents();
  const attendanceMap = await getAttendanceMap(user.id);
  const calendarEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    venueName: event.venueName,
    address: event.address,
    maxPlayers: event.maxPlayers,
    confirmedCount: event.confirmedCount,
    waitlistCount: event.waitlistCount,
    publicToken: event.publicToken,
    coverMime: event.coverMime,
    coverUpdatedAt: event.coverUpdatedAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Agenda do grupo"
        title="Próximos jogos"
        subtitle="Confirme presença e acompanhe as vagas de cada encontro."
        icon={<CalendarDays className="h-5 w-5" />}
        action={
          user.role === "ADMIN" ? (
            <Link href="/admin/eventos" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              Gerenciar
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4">
        <EventCalendar events={calendarEvents} isAdmin={user.role === "ADMIN"} />
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Nenhum jogo agendado"
          description="Quando um novo encontro for criado, ele aparece aqui com todas as informações."
          action={
            user.role === "ADMIN" ? (
              <Link href="/admin/eventos" className={cn(buttonVariants({ size: "md" }))}>
                Criar evento
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="stagger space-y-3">
          {events.map((event) => {
            const parts = dayParts(event.startsAt, settings.timezone);
            const mine = attendanceMap.get(event.id);
            const remaining = Math.max(event.maxPlayers - event.confirmedCount, 0);
            const isFull = remaining === 0;

            return (
              <Card key={event.id}>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex min-w-[62px] flex-col items-center rounded-xl border border-brand/25 bg-brand/10 px-2 py-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#9db8ff]">
                          {parts.month}
                        </span>
                        <span className="font-display text-2xl font-bold leading-none text-white">{parts.day}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                          {parts.weekday}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h2 className="font-display text-xl font-semibold uppercase leading-tight tracking-wide text-white">
                            {event.title}
                          </h2>
                          <EventStatusBadge status={event.status} />
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {formatDateTime(event.startsAt, settings.timezone)}
                          {event.endsAt ? ` – ${formatTime(event.endsAt, settings.timezone)}` : ""}
                        </p>
                        <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            {event.venueName}
                            {event.address ? <span className="block text-xs">{event.address}</span> : null}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge
                        tone={
                          mine?.isOrganizer
                            ? "brand"
                            : mine?.status === "CONFIRMED"
                              ? "success"
                              : mine?.status === "WAITLIST"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {mine?.isOrganizer
                          ? "Organizando"
                          : mine?.status === "CONFIRMED"
                            ? "Você vai"
                            : mine?.status === "WAITLIST"
                              ? `${mine.waitlistPosition}º na fila`
                              : "Não confirmou"}
                      </Badge>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {countdownLabel(event.startsAt, settings.timezone)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        <strong className="font-semibold text-ink">{event.confirmedCount}</strong>/{event.maxPlayers}{" "}
                        confirmados
                      </span>
                      <span className={cn(isFull && "text-[#86efac]")}>
                        {isFull ? "Vagas esgotadas" : `${remaining} ${remaining === 1 ? "vaga" : "vagas"}`}
                      </span>
                    </div>
                    <Progress
                      value={event.confirmedCount}
                      max={event.maxPlayers}
                      tone={isFull ? "success" : remaining <= 3 ? "warning" : "brand"}
                    />
                    {event.waitlistCount > 0 ? (
                      <p className="text-[11px] text-[#fbd38d]">{event.waitlistCount} na lista de espera</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {user.role === "ADMIN" ? (
                      <OrganizerToggle
                        eventId={event.id}
                        attendanceId={mine?.attendanceId}
                        isOrganizer={Boolean(mine?.isOrganizer)}
                        isAdmin
                      />
                    ) : (
                      <AttendanceControls
                        eventId={event.id}
                        status={mine?.status ?? null}
                        waitlistPosition={mine?.waitlistPosition ?? null}
                        isFull={isFull}
                        allowWaitlist={settings.allowWaitlist}
                        isOrganizer={Boolean(mine?.isOrganizer)}
                        size="sm"
                        block={false}
                      />
                    )}
                    <Link
                      href={`/presencas?evento=${event.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Lista completa
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                    <Link
                      href={`/racha?evento=${event.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Racha
                    </Link>
                    {event.publicToken ? (
                      <ShareEventButton token={event.publicToken} title={event.title} />
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
