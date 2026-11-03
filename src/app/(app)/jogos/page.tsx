import Link from "next/link";
import { CalendarDays, Clock, MapPin, Pencil, Users } from "lucide-react";
import { AttendanceControls } from "@/components/features/attendance-controls";
import { AutoRefresh } from "@/components/features/auto-refresh";
import { OrganizerToggle } from "@/components/features/organizer-toggle";
import { EventCalendar } from "@/components/features/event-calendar";
import { ShareEventButton } from "@/components/features/share-event-button";
import { EventPriceBadge } from "@/components/features/event-price-badge";
import { SurfaceBadge } from "@/components/features/surface-badge";
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
    surface: event.surface,
    maxPlayers: event.maxPlayers,
    paymentMode: event.paymentMode,
    priceCents: event.priceCents,
    confirmedCount: event.confirmedCount,
    reservedCount: event.reservedCount,
    pendingPaymentCount: event.pendingPaymentCount,
    waitlistCount: event.waitlistCount,
    publicToken: event.publicToken,
    coverMime: event.coverMime,
    coverUpdatedAt: event.coverUpdatedAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <AutoRefresh intervalMs={15000} />
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
            const organizing = Boolean(mine?.isOrganizer) || (user.role === "ADMIN" && !mine);
            const remaining = Math.max(event.maxPlayers - event.reservedCount, 0);
            const isFull = remaining === 0;
            const eventIsOpen = event.status === "SCHEDULED";

            return (
              <Card key={event.id}>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex min-w-[62px] flex-col items-center rounded-xl border border-brand/25 bg-brand/10 px-2 py-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-brand">
                          {parts.month}
                        </span>
                        <span className="font-display text-2xl font-bold leading-none text-ink">{parts.day}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                          {parts.weekday}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-display text-xl font-semibold uppercase leading-tight tracking-wide text-ink">
                          {event.title}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            {formatDateTime(event.startsAt, settings.timezone)}
                            {event.endsAt ? ` – ${formatTime(event.endsAt, settings.timezone)}` : ""}
                          </span>
                          <SurfaceBadge surface={event.surface} />
                          <EventPriceBadge paymentMode={event.paymentMode} priceCents={event.priceCents} />
                        </div>
                        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            {event.venueName}
                            {event.address ? <span className="block text-[11px]">{event.address}</span> : null}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge
                        tone={
                          organizing
                            ? "brand"
                            : mine?.status === "CONFIRMED"
                              ? "success"
                              : mine?.status === "PENDING_PAYMENT"
                                ? "warning"
                                : mine?.status === "WAITLIST"
                                  ? "warning"
                                  : "neutral"
                        }
                      >
                        {organizing
                          ? "Organizando"
                          : mine?.status === "CONFIRMED"
                            ? "Você vai"
                            : mine?.status === "PENDING_PAYMENT"
                              ? mine.paymentProofId
                                ? "Em análise"
                                : "Aguardando Pix"
                              : mine?.status === "WAITLIST"
                                ? `${mine.waitlistPosition}º na fila`
                                : "Não confirmou"}
                      </Badge>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {event.status === "SCHEDULED"
                          ? countdownLabel(event.startsAt, settings.timezone)
                          : event.status === "FINISHED"
                            ? "Realizado"
                            : "Cancelado"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        <strong className="font-semibold text-ink">{event.confirmedCount}</strong>/{event.maxPlayers}{" "}
                        confirmados
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn(isFull && "text-success")}>
                          {isFull ? "Vagas esgotadas" : `${remaining} ${remaining === 1 ? "vaga" : "vagas"}`}
                        </span>
                        {event.pendingPaymentCount > 0 ? (
                          <span className="text-warning">
                            {event.pendingPaymentCount}{" "}
                            {event.pendingPaymentCount === 1 ? "pendente" : "pendentes"}
                          </span>
                        ) : null}
                        {event.waitlistCount > 0 ? (
                          <span className="text-warning">{event.waitlistCount} na espera</span>
                        ) : null}
                      </span>
                    </div>
                    <Progress
                      value={event.reservedCount}
                      max={event.maxPlayers}
                      tone={isFull ? "success" : remaining <= 3 ? "warning" : "brand"}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {!eventIsOpen ? (
                        <span className="text-xs text-muted">Inscrições encerradas</span>
                      ) : user.role === "ADMIN" ? (
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
                          attendanceId={mine?.attendanceId}
                          paymentProofUpload={event.paymentProofUpload}
                          paymentProofId={mine?.paymentProofId ?? null}
                          paymentProofNote={mine?.paymentProofNote ?? null}
                          requiresPayment={event.paymentMode === "PAID"}
                          size="sm"
                          block={false}
                        />
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <Link
                        href={`/presencas?evento=${event.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        Lista
                      </Link>
                      <Link
                        href={`/racha?evento=${event.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        Racha
                      </Link>
                      {event.publicToken ? (
                        <ShareEventButton token={event.publicToken} title={event.title} compact />
                      ) : null}
                      {user.role === "ADMIN" ? (
                        <Link
                          href={`/admin/eventos?edit=${event.id}#edit-${event.id}`}
                          aria-label="Editar evento"
                          title="Editar evento"
                          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      ) : null}
                    </div>
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
