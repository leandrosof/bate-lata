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
  Wallet,
  X,
} from "lucide-react";
import {
  adminAddAttendanceAction,
  adminApprovePaymentAction,
  adminClearPaymentProofAction,
  adminMoveWaitlistAction,
  adminPromoteAttendanceAction,
  adminRejectPaymentAction,
  adminRemoveAttendanceAction,
  toggleOrganizerAction,
} from "@/actions/attendance";
import { AttendanceControls } from "@/components/features/attendance-controls";
import { AutoRefresh } from "@/components/features/auto-refresh";
import { OrganizerToggle } from "@/components/features/organizer-toggle";
import { PaymentProofPreview } from "@/components/features/payment-proof-preview";
import { ShareAttendanceButton } from "@/components/features/share-attendance-button";
import { EventPicker } from "@/components/features/event-picker";
import { EventStatusBadge } from "@/components/features/status-badge";
import { EventPriceBadge } from "@/components/features/event-price-badge";
import { SurfaceBadge } from "@/components/features/surface-badge";
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
import { formatCents } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { surfaceLabel } from "@/lib/surface";
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
    ? ([...roster.confirmed, ...roster.pendingPayment, ...roster.organizers, ...roster.waitlist].find(
        (row) => row.userId === user.id,
      ) ?? null)
    : null;

  const isAdmin = user.role === "ADMIN";
  const reservedCount = (roster?.confirmed.length ?? 0) + (roster?.pendingPayment.length ?? 0);
  const isFull = Boolean(selected && roster && reservedCount >= selected.maxPlayers);
  const remaining = selected ? Math.max(selected.maxPlayers - reservedCount, 0) : 0;
  const eventIsOpen = Boolean(selected && selected.status === "SCHEDULED");
  const pendingPaymentCount = roster?.pendingPayment.length ?? 0;
  const pendingWithProofCount =
    roster?.pendingPayment.filter((player) => player.paymentProofId).length ?? 0;
  const pendingWithoutProofCount = pendingPaymentCount - pendingWithProofCount;
  const pendingPaymentTitle =
    pendingWithProofCount === 0
      ? "Aguardando pagamento"
      : pendingWithoutProofCount === 0
        ? "Aguardando aprovação"
        : "Aguardando pagamento ou aprovação";
  const pendingPaymentBadge =
    pendingWithProofCount === 0
      ? "aguardando Pix"
      : pendingWithoutProofCount === 0
        ? "aguardando análise"
        : "pendentes";
  const pendingPaymentDescription =
    pendingWithProofCount === 0
      ? "A vaga fica reservada até o administrador aprovar ou rejeitar o Pix."
      : pendingWithoutProofCount === 0
        ? "O comprovante Pix foi enviado e a vaga continua reservada até a análise do administrador."
        : "Há comprovantes Pix aguardando análise e pagamentos pendentes.";

  return (
    <div>
      <AutoRefresh intervalMs={15000} />
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
                    <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
                      {selected.title}
                    </h2>
                    <SurfaceBadge surface={selected.surface} />
                    <EventPriceBadge paymentMode={selected.paymentMode} priceCents={selected.priceCents} />
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
                  <p className="font-display text-3xl font-bold leading-none text-ink">
                    {reservedCount}
                    <span className="text-lg text-muted">/{selected.maxPlayers}</span>
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {remaining > 0 ? `${remaining} vagas` : "Lotado"}
                  </p>
                </div>
              </div>

              {selected.paymentMode === "PAID" ? (
                <div className="rounded-xl border border-brand/25 bg-brand/10 p-3 text-sm">
                  <p className="font-semibold text-ink">
                    {selected.priceCents && selected.priceCents > 0
                      ? `Valor: ${formatCents(selected.priceCents)} por jogador`
                      : "Valor pendente. Configure o valor deste evento pago."}
                  </p>
                  {selected.priceCents && selected.priceCents > 0 ? (
                    <>
                      <p className="mt-0.5 text-xs text-muted">
                        Pix: <span className="font-medium text-ink">{settings.pixKey ?? "não configurado"}</span>
                        {settings.pixRecipientName ? ` · ${settings.pixRecipientName}` : ""}
                      </p>
                      {settings.pixInstructions ? (
                        <p className="mt-1 whitespace-pre-line text-xs text-muted">{settings.pixInstructions}</p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}

              <Progress
                value={reservedCount}
                max={selected.maxPlayers}
                tone={isFull ? "success" : remaining <= 3 ? "warning" : "brand"}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">{roster.confirmed.length} confirmados</Badge>
                <Badge tone="warning">
                  {pendingPaymentCount} {pendingPaymentBadge}
                </Badge>
                <Badge tone="warning">{roster.waitlist.length} na espera</Badge>
                <Badge tone="neutral">{roster.pending.length} sem resposta</Badge>
                <div className="ml-auto">
                  <ShareAttendanceButton
                    title={selected.title}
                    dateLabel={formatDateTime(selected.startsAt, settings.timezone)}
                    venue={selected.venueName}
                    surface={surfaceLabel(selected.surface)}
                    token={selected.publicToken}
                    confirmed={roster.confirmed.map((row) => row.name)}
                    organizers={roster.organizers.map((row) => row.name)}
                  />
                </div>
              </div>

              {!eventIsOpen ? (
                <p className="rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-center text-xs text-muted">
                  Inscrições encerradas. Não é mais possível confirmar presença.
                </p>
              ) : isAdmin ? (
                <OrganizerToggle
                  eventId={selected.id}
                  attendanceId={mine?.attendanceId}
                  isOrganizer={Boolean(mine?.isOrganizer)}
                  isAdmin
                />
              ) : (
                <AttendanceControls
                  eventId={selected.id}
                  status={mine?.status ?? null}
                  waitlistPosition={mine?.waitlistPosition ?? null}
                  isFull={isFull}
                  allowWaitlist={settings.allowWaitlist}
                  isOrganizer={Boolean(mine?.isOrganizer)}
                  attendanceId={mine?.attendanceId}
                  paymentProofUpload={selected.paymentProofUpload}
                  paymentProofId={mine?.paymentProofId ?? null}
                  paymentProofNote={mine?.paymentProofNote ?? null}
                  requiresPayment={selected.paymentMode === "PAID"}
                />
              )}
            </CardBody>
          </Card>

          {roster.pendingPayment.length > 0 ? (
            <Card data-testid="pending-payment-card" className="border-[rgba(245,185,66,0.35)]">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-soft text-warning">
                    <Wallet className="h-4 w-4" aria-hidden />
                  </span>
                  <CardTitle>{pendingPaymentTitle}</CardTitle>
                </div>
                <Badge tone="warning">{roster.pendingPayment.length}</Badge>
              </CardHeader>
              <CardBody className="space-y-2 pt-2">
                <p className="text-xs text-muted">{pendingPaymentDescription}</p>
                <ul className="divide-y divide-line/60">
                  {roster.pendingPayment.map((player) => (
                    <li key={player.attendanceId} className="flex flex-wrap items-center gap-2 py-2">
                      <Avatar
                        userId={player.userId}
                        name={player.name}
                        version={player.avatarUpdatedAt}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{player.name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted">
                          {formatCents(selected.priceCents)} · desde{" "}
                          {formatDateTime(player.since, settings.timezone)}
                        </p>
                      </div>
                      {isAdmin && player.paymentProofId ? (
                        <div className="w-full rounded-lg border border-line bg-surface-2/50 p-2 text-[11px] text-muted">
                          <PaymentProofPreview
                            attendanceId={player.attendanceId}
                            title={`Comprovante de ${player.name}`}
                            meta={`Comprovante de ${
                              player.paymentProofImageBytes
                                ? `${Math.max(1, Math.round(player.paymentProofImageBytes / 1024))} KB`
                                : "imagem indisponível"
                            }`}
                            imageClassName="max-h-44"
                          />
                          {player.paymentProofNote ? (
                            <p className="mt-0.5 whitespace-pre-line text-ink/80">
                              Comentário: {player.paymentProofNote}
                            </p>
                          ) : null}
                        </div>
                      ) : isAdmin ? (
                        <Badge tone="warning">Sem comprovante</Badge>
                      ) : null}
                      {isAdmin ? (
                        <div className="flex items-center gap-1.5">
                          <ActionButton
                            action={adminApprovePaymentAction}
                            fields={{ attendanceId: player.attendanceId }}
                            variant="success"
                            size="sm"
                            confirmMessage={`Aprovar o pagamento de ${player.name}?`}
                            icon={<Check className="h-3.5 w-3.5" aria-hidden />}
                          >
                            Aprovar
                          </ActionButton>
                          <ActionButton
                            action={adminRejectPaymentAction}
                            fields={{ attendanceId: player.attendanceId }}
                            variant="danger"
                            size="sm"
                            confirmMessage={`Rejeitar o pagamento de ${player.name}? A vaga será liberada.`}
                            icon={<X className="h-3.5 w-3.5" aria-hidden />}
                          >
                            Rejeitar
                          </ActionButton>
                          {player.paymentProofId ? (
                            <ActionButton
                              action={adminClearPaymentProofAction}
                              fields={{ attendanceId: player.attendanceId }}
                              variant="ghost"
                              size="sm"
                              confirmMessage={`Limpar o comprovante de ${player.name}? Ele poderá enviar outro.`}
                            >
                              Limpar
                            </ActionButton>
                          ) : null}
                        </div>
                      ) : player.userId === user.id ? (
                        <Badge tone="warning">Aguardando aprovação</Badge>
                      ) : (
                        <Badge>Reservada</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <Card data-testid="confirmed-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(34,197,94,0.12)] text-success">
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
                              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-brand">
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(245,185,66,0.12)] text-warning">
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
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(245,185,66,0.14)] text-[10px] font-bold text-warning">
                          {player.waitlistPosition ?? index + 1}
                        </span>
                        <Avatar userId={player.userId} name={player.name} version={player.avatarUpdatedAt} size="sm" />
                        <p className="min-w-0 flex-1 truncate text-sm text-ink">
                          {player.name}
                          {player.userId === user.id ? (
                            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-warning">
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
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
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-ink/[0.03]"
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