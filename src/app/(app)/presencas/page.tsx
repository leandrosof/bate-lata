import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  ListOrdered,
  MapPin,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  adminAddAttendanceAction,
  adminMoveWaitlistAction,
  adminPromoteAttendanceAction,
  adminRemoveAttendanceAction,
  toggleOrganizerAction,
} from "@/actions/attendance";
import { AttendanceControls } from "@/components/features/attendance-controls";
import { EventPicker } from "@/components/features/event-picker";
import { EventStatusBadge } from "@/components/features/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { getEventById, getEventRoster, listOperationalEvents } from "@/db/queries/events";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Presenças" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const settings = await getSettings();
  const params = await searchParams;
  const upcoming = await listOperationalEvents();

  const requestedId = typeof params.evento === "string" ? params.evento : undefined;
  const selected = requestedId
    ? ((upcoming.find((event) => event.id === requestedId) ?? (await getEventById(requestedId))) as
        | Awaited<ReturnType<typeof getEventById>>
        | null)
    : (upcoming[0] ?? null);

  const roster = selected ? await getEventRoster(selected.id) : null;
  const mine = roster
    ? ([...roster.confirmed, ...roster.organizers, ...roster.waitlist].find((row) => row.userId === user.id) ?? null)
    : null;

  const isAdmin = user.role === "ADMIN";
  const isFull = Boolean(selected && roster && roster.confirmed.length >= selected.maxPlayers);
  const remaining = selected ? Math.max(selected.maxPlayers - (roster?.confirmed.length ?? 0), 0) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Lista do próximo encontro"
        title="Presenças"
        subtitle="Quem confirmou, quem está na espera e quem ainda não respondeu."
        icon={<Users className="h-5 w-5" />}
        action={
          isAdmin ? (
            <Link href="/admin/eventos" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              Eventos
            </Link>
          ) : undefined
        }
      />

      <EventPicker events={upcoming} selectedId={selected?.id} basePath="/presencas" timeZone={settings.timezone} />

      {!selected || !roster ? (
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="Nenhum evento disponível"
          description="Assim que um novo encontro for criado, a lista de presenças aparece aqui."
          action={
            isAdmin ? (
              <Link href="/admin/eventos" className={cn(buttonVariants({ size: "md" }))}>
                Criar evento
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-white">
                      {selected.title}
                    </h2>
                    <EventStatusBadge status={selected.status} />
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {formatDateTime(selected.startsAt, settings.timezone)}
                  </p>
                  <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {selected.venueName}
                      {selected.address ? <span className="block text-xs">{selected.address}</span> : null}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl font-bold leading-none text-white">
                    {roster.confirmed.length}
                    <span className="text-lg text-muted">/{selected.maxPlayers}</span>
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {remaining > 0 ? `${remaining} vagas` : "Lotado"}
                  </p>
                </div>
              </div>

              <Progress
                value={roster.confirmed.length}
                max={selected.maxPlayers}
                tone={isFull ? "success" : remaining <= 3 ? "warning" : "brand"}
              />

              <div className="flex flex-wrap gap-2">
                <Badge tone="success">{roster.confirmed.length} confirmados</Badge>
                <Badge tone="warning">{roster.waitlist.length} na espera</Badge>
                <Badge tone="neutral">{roster.pending.length} sem resposta</Badge>
              </div>

              <AttendanceControls
                eventId={selected.id}
                status={mine?.status ?? null}
                waitlistPosition={mine?.waitlistPosition ?? null}
                isFull={isFull}
                allowWaitlist={settings.allowWaitlist}
                isOrganizer={Boolean(mine?.isOrganizer)}
              />
            </CardBody>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card data-testid="confirmed-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(34,197,94,0.12)] text-[#86efac]">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <CardTitle>Confirmados</CardTitle>
                </div>
                <Badge tone="success">{roster.confirmed.length}</Badge>
              </CardHeader>
              <CardBody className="pt-2">
                {roster.confirmed.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">Ninguém confirmou ainda.</p>
                ) : (
                  <ul className="divide-y divide-line/60">
                    {roster.confirmed.map((player, index) => (
                      <li key={player.attendanceId} className="flex items-center gap-2.5 py-2">
                        <span className="w-4 text-right text-[10px] font-bold text-muted/70">{index + 1}</span>
                        <Avatar userId={player.userId} name={player.name} version={player.avatarUpdatedAt} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {player.name}
                            {player.userId === user.id ? (
                              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7fa2ff]">
                                você
                              </span>
                            ) : null}
                          </p>
                          {player.nickname ? <p className="text-[11px] text-muted">@{player.nickname}</p> : null}
                        </div>
                        {isAdmin ? (
                          <div className="flex items-center gap-0.5">
                            {player.userId === user.id ? (
                              <ActionButton
                                action={toggleOrganizerAction}
                                fields={{ attendanceId: player.attendanceId }}
                                variant="ghost"
                                size="icon-sm"
                                confirmMessage="Marcar você como organizador? Você sai da lista de jogadores e não entra nos times."
                                title="Só organizar"
                              >
                                <UserCog className="h-3.5 w-3.5" aria-hidden />
                              </ActionButton>
                            ) : null}
                            <ActionButton
                              action={adminRemoveAttendanceAction}
                              fields={{ attendanceId: player.attendanceId }}
                              variant="ghost"
                              size="icon-sm"
                              confirmMessage={`Remover ${player.name} da lista?`}
                              title="Remover presença"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                            </ActionButton>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card data-testid="waitlist-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(245,185,66,0.12)] text-[#fbd38d]">
                    <ListOrdered className="h-4 w-4" aria-hidden />
                  </span>
                  <CardTitle>Lista de espera</CardTitle>
                </div>
                <Badge tone="warning">{roster.waitlist.length}</Badge>
              </CardHeader>
              <CardBody className="pt-2">
                {roster.waitlist.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">
                    Fila vazia. Quem chegar depois das vagas entra aqui.
                  </p>
                ) : (
                  <ul className="divide-y divide-line/60">
                    {roster.waitlist.map((player, index) => (
                      <li key={player.attendanceId} className="flex items-center gap-2 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(245,185,66,0.14)] text-[10px] font-bold text-[#fbd38d]">
                          {player.waitlistPosition ?? index + 1}
                        </span>
                        <Avatar userId={player.userId} name={player.name} version={player.avatarUpdatedAt} size="sm" />
                        <p className="min-w-0 flex-1 truncate text-sm text-ink">
                          {player.name}
                          {player.userId === user.id ? (
                            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-[#fbd38d]">
                              você
                            </span>
                          ) : null}
                        </p>
                        {isAdmin ? (
                          <div className="flex items-center gap-0.5">
                            {index > 0 ? (
                              <ActionButton
                                action={adminMoveWaitlistAction}
                                fields={{ attendanceId: player.attendanceId, direction: "up" }}
                                variant="ghost"
                                size="icon-sm"
                                title="Subir na fila"
                              >
                                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                              </ActionButton>
                            ) : null}
                            {index < roster.waitlist.length - 1 ? (
                              <ActionButton
                                action={adminMoveWaitlistAction}
                                fields={{ attendanceId: player.attendanceId, direction: "down" }}
                                variant="ghost"
                                size="icon-sm"
                                title="Descer na fila"
                              >
                                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                              </ActionButton>
                            ) : null}
                            {!isFull ? (
                              <ActionButton
                                action={adminPromoteAttendanceAction}
                                fields={{ attendanceId: player.attendanceId }}
                                variant="ghost"
                                size="icon-sm"
                                title="Promover para confirmado"
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden />
                              </ActionButton>
                            ) : null}
                            <ActionButton
                              action={adminRemoveAttendanceAction}
                              fields={{ attendanceId: player.attendanceId }}
                              variant="ghost"
                              size="icon-sm"
                              confirmMessage={`Remover ${player.name} da fila?`}
                              title="Remover da fila"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                            </ActionButton>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          {roster.organizers.length > 0 ? (
            <Card data-testid="organizers-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-[#9db8ff]">
                    <UserCog className="h-4 w-4" aria-hidden />
                  </span>
                  <CardTitle>Organizadores</CardTitle>
                </div>
                <Badge tone="brand">{roster.organizers.length}</Badge>
              </CardHeader>
              <CardBody className="space-y-1.5 pt-2">
                <p className="text-xs text-muted">Não entram na capacidade, na fila nem nos times.</p>
                <ul className="divide-y divide-line/60">
                  {roster.organizers.map((organizer) => (
                    <li key={organizer.attendanceId} className="flex items-center gap-2 py-2">
                      <Avatar
                        userId={organizer.userId}
                        name={organizer.name}
                        version={organizer.avatarUpdatedAt}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{organizer.name}</span>
                      {isAdmin && organizer.userId === user.id ? (
                        <ActionButton
                          action={toggleOrganizerAction}
                          fields={{ attendanceId: organizer.attendanceId }}
                          variant="outline"
                          size="sm"
                        >
                          Vou jogar
                        </ActionButton>
                      ) : (
                        <Badge>Organizador</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card data-testid="pending-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-muted">
                  <Clock className="h-4 w-4" aria-hidden />
                </span>
                <CardTitle>Ainda não confirmaram</CardTitle>
              </div>
              <Badge>{roster.pending.length}</Badge>
            </CardHeader>
            <CardBody className="pt-2">
              {roster.pending.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">Todos os jogadores ativos já responderam.</p>
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {roster.pending.map((player) => (
                    <li
                      key={player.userId}
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-white/[0.03]"
                    >
                      <Avatar userId={player.userId} name={player.name} version={player.avatarUpdatedAt} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm text-muted">{player.name}</span>
                      {isAdmin ? (
                        <ActionButton
                          action={adminAddAttendanceAction}
                          fields={{ eventId: selected.id, userId: player.userId }}
                          variant="outline"
                          size="sm"
                          icon={<UserPlus className="h-3.5 w-3.5" aria-hidden />}
                        >
                          Confirmar
                        </ActionButton>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {isAdmin ? (
            <p className="pb-2 text-center text-[11px] text-muted">
              Como administrador, você pode adicionar ou remover jogadores. A fila é reorganizada automaticamente
              quando alguém cancela.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}