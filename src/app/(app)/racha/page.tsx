import Link from "next/link";
import {
  ArrowRight,
  Flag,
  LayoutGrid,
  ListOrdered,
  LogIn,
  LogOut,
  Minus,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Shuffle,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { adjustScoreAction, setScoreAction } from "@/actions/games";
import {
  addToRachaAction,
  checkInAttendanceAction,
  endRachaAction,
  finalizeMatchAction,
  leaveRachaAction,
  mixNextMatchAction,
  openCourtAction,
  restartRachaAction,
  startMatchAction,
  startRachaAction,
  substitutePlayerAction,
  undoRachaAction,
} from "@/actions/racha";
import { AutoRefresh } from "@/components/features/auto-refresh";
import { CloseCourtDialog } from "@/components/features/close-court-dialog";
import { EventPicker } from "@/components/features/event-picker";
import { OrganizerToggle } from "@/components/features/organizer-toggle";
import { QueueSwapDialog } from "@/components/features/queue-swap-dialog";
import { GameDurationBadge } from "@/components/features/game-duration";
import { DrawStatusBadge } from "@/components/features/status-badge";
import { TeamCard, TeamPill } from "@/components/features/team-card";
import { ActionButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { getEventById, getEventRoster, listOperationalEvents } from "@/db/queries/events";
import { getRachaView } from "@/db/queries/racha";
import { requireUser } from "@/lib/auth";
import { chunkQueue } from "@/lib/racha";
import { getSettings } from "@/lib/settings";
import { TEAM_SIZE_OPTIONS, teamVisualForIndex } from "@/lib/teams";
import { formatDateTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Racha" };

export default async function RachaPage({
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

  const isAdmin = user.role === "ADMIN";
  const view = selected ? await getRachaView(selected.id) : null;
  const roster = selected ? await getEventRoster(selected.id) : null;

  const myAttendance = roster
    ? [...roster.confirmed, ...roster.organizers, ...roster.waitlist].find(
        (row) => row.userId === user.id,
      ) ?? null
    : null;
  const session = view?.session ?? null;
  const teamSize = view?.teamSize ?? settings.defaultTeamSize;
  const courts = view?.courts ?? [];
  const requestedCourt =
    typeof params.quadra === "string" ? Number(params.quadra) : Number.NaN;
  const selectedCourt =
    courts.find((court) => court.number === requestedCourt) ??
    courts.find((court) => court.game) ??
    courts[0] ??
    null;
  const game = selectedCourt?.game ?? null;
  const canUndoSelected = Boolean(
    view?.canUndo && view.history[0]?.court === selectedCourt?.number,
  );
  const sessionHours = view?.sessionAgeHours ?? 0;
  const teamById = new Map((view?.teams ?? []).map((team) => [team.id, team]));
  let nextTeamIndex = view?.teams.length ?? 0;
  const queueGroups = chunkQueue(view?.queue ?? [], teamSize).map((players, index) => {
    const blockIds = new Set(
      players
        .map((player) => player.queueTeamId)
        .filter((value): value is string => Boolean(value)),
    );
    const teamId =
      blockIds.size === 1 && players.every((player) => player.queueTeamId === [...blockIds][0])
        ? [...blockIds][0]
        : null;
    const team = teamId ? teamById.get(teamId) : null;
    const visual = team
      ? { name: team.name, color: team.color }
      : (() => {
          const next = teamVisualForIndex(nextTeamIndex);
          nextTeamIndex += 1;
          return { name: next.name, color: next.color };
        })();
    return { key: `group-${index}`, players, visual };
  });
  const onCourtIds = new Set(
    game ? [...game.teamAPlayers, ...game.teamBPlayers].map((player) => player.userId) : [],
  );

  return (
    <div>
      <AutoRefresh intervalMs={15000} />
      <PageHeader
        eyebrow="Jogos livres"
        title="Racha"
        subtitle="Lista única, times automáticos, placar e próximo jogo sem escolher time."
        icon={<Repeat className="h-5 w-5" />}
        action={session ? <DrawStatusBadge status={session.status} /> : undefined}
        actionInline
      />

      <EventPicker events={upcoming} selectedId={selected?.id} basePath="/racha" timeZone={settings.timezone} />

      {!selected || !roster || !view ? (
        <EmptyState
          icon={<Repeat className="h-5 w-5" />}
          title="Nenhum evento disponível"
          description="Crie um evento e adicione os jogadores para começar o racha."
          action={
            isAdmin ? (
              <Link href="/admin/eventos" className={cn(buttonVariants({ size: "md" }))}>
                Criar evento
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {!session ? (
            <>
            <Card>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
                      {selected.title}
                    </h2>
                    <p className="text-xs text-muted">
                      {formatDateTime(selected.startsAt, settings.timezone)} · {roster.confirmed.length} confirmados
                    </p>
                  </div>
                  <Badge tone="brand">{settings.defaultTeamSize} por time</Badge>
                </div>

                {isAdmin ? (
                  <ActionForm
                    action={startRachaAction}
                    hiddenFields={{ eventId: selected.id }}
                    submitLabel="Iniciar racha"
                    pendingLabel="Montando times..."
                    variant="primary"
                    size="lg"
                    submitIcon={<Play className="h-4 w-4" aria-hidden />}
                  >
                    <div className="grid max-w-[420px] gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="teamSize" required>
                          Jogadores por time
                        </Label>
                        <Select
                          id="teamSize"
                          name="teamSize"
                          defaultValue={String(settings.defaultTeamSize)}
                        >
                          {TEAM_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                              {size} por time
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="courtCount" required>
                          Quadras
                        </Label>
                        <Input
                          id="courtCount"
                          name="courtCount"
                          type="number"
                          min={1}
                          max={20}
                          defaultValue={1}
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted">
                      O sistema usa os jogadores confirmados da lista e monta a primeira partida sozinho.
                    </p>
                  </ActionForm>
                ) : (
                  <p className="text-xs text-muted">Aguardando o administrador iniciar o racha.</p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted" aria-hidden />
                  <CardTitle>Lista do racha</CardTitle>
                </div>
                <Badge>{roster.confirmed.length} confirmados</Badge>
              </CardHeader>
              <CardBody className="space-y-2 pt-2">
                <p className="text-xs text-muted">
                  Quem já confirmou presença entra na fila automaticamente ao iniciar o racha.
                </p>
                {isAdmin && roster.pending.length > 0 ? (
                  <Disclosure
                    title="Adicionar jogador"
                    subtitle={`${roster.pending.length} jogador(es) sem resposta`}
                  >
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {roster.pending.map((player) => (
                        <li
                          key={player.userId}
                          className="flex items-center gap-2 rounded-lg px-1.5 py-1.5"
                        >
                          <Avatar
                            userId={player.userId}
                            name={player.name}
                            version={player.avatarUpdatedAt}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-muted">
                            {player.name}
                          </span>
                          <ActionButton
                            action={addToRachaAction}
                            fields={{ eventId: selected.id, userId: player.userId }}
                            variant="outline"
                            size="sm"
                            icon={<UserPlus className="h-3.5 w-3.5" aria-hidden />}
                          >
                            Adicionar
                          </ActionButton>
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                ) : null}
              </CardBody>
            </Card>
            </>
          ) : (
            <>
              {sessionHours >= 6 ? (
                <Alert tone="warning" title={`Sessão aberta há ${sessionHours}h`}>
                  Finalize a partida atual, desfaça o último resultado ou encerre o racha para liberar a lista.
                </Alert>
              ) : null}

              <Card data-testid="racha-courts">
                <CardHeader className="flex-wrap items-center gap-2 pb-0">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-muted" aria-hidden />
                    <CardTitle className="text-base">Quadras</CardTitle>
                  </div>
                  {isAdmin ? (
                    <div className="ml-auto flex items-center gap-1.5">
                      <ActionButton
                        action={openCourtAction}
                        fields={{ drawId: session.id }}
                        variant="outline"
                        size="sm"
                        confirmTitle="Nova quadra"
                        confirmLabel="Abrir quadra"
                        confirmMessage="Deseja realmente abrir uma nova quadra?"
                        icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
                      >
                        Abrir quadra
                      </ActionButton>
                      <CloseCourtDialog
                        drawId={session.id}
                        courts={courts.map((court) => ({
                          number: court.number,
                          inUse: Boolean(court.game),
                        }))}
                        defaultCourt={selectedCourt?.number}
                      />
                    </div>
                  ) : null}
                </CardHeader>
                <CardBody className="pt-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {courts.map((court) => (
                      <Link
                        key={court.id}
                        href={`/racha?evento=${selected.id}&quadra=${court.number}`}
                        className={cn(
                          buttonVariants({
                            variant:
                              selectedCourt?.number === court.number ? "primary" : "secondary",
                            size: "md",
                          }),
                          "w-full justify-between px-2.5",
                        )}
                      >
                        <span className="truncate">Quadra {court.number}</span>
                        <span className="text-[10px] uppercase tracking-wider opacity-70">
                          {court.game
                            ? court.game.status === "IN_PROGRESS"
                              ? "ao vivo"
                              : "pronta"
                            : "vazia"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {game ? (
                <Card data-testid="racha-current-game">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                        <Trophy className="h-4 w-4" aria-hidden />
                      </span>
                      <CardTitle>
                        {game.status === "IN_PROGRESS" ? "Partida atual" : "Próxima partida"}
                      </CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <GameDurationBadge
                        startedAt={game.startedAt}
                        finishedAt={game.finishedAt}
                        live={game.status === "IN_PROGRESS"}
                      />
                      <Badge tone={game.status === "IN_PROGRESS" ? "live" : "warning"}>
                        {game.status === "IN_PROGRESS" ? "Ao vivo" : "Pronta"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-3 pt-2">
                    <div className="rounded-2xl border border-line bg-surface-2/60 p-3 backdrop-blur-sm sm:p-4">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                        <div className="min-w-0 space-y-2">
                          <div className="flex min-w-0 justify-end">
                            <TeamPill name={game.teamAName} color={game.teamAColor} className="max-w-full" />
                          </div>
                          <div className="flex items-center justify-center gap-1.5">
                            {isAdmin && game.status === "IN_PROGRESS" ? (
                              <ActionButton
                                action={adjustScoreAction}
                                fields={{ gameId: game.id, side: "A", delta: -1 }}
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl text-muted hover:bg-ink/10 hover:text-ink"
                                title={`-1 ${game.teamAName}`}
                              >
                                <Minus className="h-4 w-4" aria-hidden />
                              </ActionButton>
                            ) : null}
                            <p
                              className="min-w-[2.5rem] text-center font-display text-4xl font-extrabold tabular-nums tracking-tight text-ink sm:text-5xl"
                              data-testid="racha-score-a"
                            >
                              {game.scoreA}
                            </p>
                            {isAdmin && game.status === "IN_PROGRESS" ? (
                              <ActionButton
                                action={adjustScoreAction}
                                fields={{ gameId: game.id, side: "A", delta: 1 }}
                                variant="primary"
                                size="icon"
                                className="h-10 w-10 rounded-xl shadow-md transition active:scale-95"
                                title={`+1 ${game.teamAName}`}
                              >
                                <Plus className="h-5 w-5" aria-hidden />
                              </ActionButton>
                            ) : null}
                          </div>
                        </div>

                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-ink/5 font-display text-xs font-bold uppercase tracking-widest text-muted/80 backdrop-blur-sm">
                          x
                        </span>

                        <div className="min-w-0 space-y-2">
                          <div className="flex min-w-0 justify-start">
                            <TeamPill name={game.teamBName} color={game.teamBColor} className="max-w-full" />
                          </div>
                          <div className="flex items-center justify-center gap-1.5">
                            {isAdmin && game.status === "IN_PROGRESS" ? (
                              <ActionButton
                                action={adjustScoreAction}
                                fields={{ gameId: game.id, side: "B", delta: -1 }}
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl text-muted hover:bg-ink/10 hover:text-ink"
                                title={`-1 ${game.teamBName}`}
                              >
                                <Minus className="h-4 w-4" aria-hidden />
                              </ActionButton>
                            ) : null}
                            <p
                              className="min-w-[2.5rem] text-center font-display text-4xl font-extrabold tabular-nums tracking-tight text-ink sm:text-5xl"
                              data-testid="racha-score-b"
                            >
                              {game.scoreB}
                            </p>
                            {isAdmin && game.status === "IN_PROGRESS" ? (
                              <ActionButton
                                action={adjustScoreAction}
                                fields={{ gameId: game.id, side: "B", delta: 1 }}
                                variant="primary"
                                size="icon"
                                className="h-10 w-10 rounded-xl shadow-md transition active:scale-95"
                                title={`+1 ${game.teamBName}`}
                              >
                                <Plus className="h-5 w-5" aria-hidden />
                              </ActionButton>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <TeamCard
                        compact
                        className="min-w-0"
                        team={{
                          name: game.teamAName,
                          color: game.teamAColor,
                          players: game.teamAPlayers,
                        }}
                        teamSize={teamSize}
                        highlight
                      />
                      <TeamCard
                        compact
                        className="min-w-0"
                        team={{
                          name: game.teamBName,
                          color: game.teamBColor,
                          players: game.teamBPlayers,
                        }}
                        teamSize={teamSize}
                        highlight
                      />
                    </div>

                    {isAdmin && game.status === "NOT_STARTED" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionButton
                          action={startMatchAction}
                          fields={{ gameId: game.id }}
                          variant="primary"
                          size="lg"
                          icon={<Play className="h-4 w-4" aria-hidden />}
                        >
                          Iniciar partida
                        </ActionButton>
                        <ActionButton
                          action={mixNextMatchAction}
                          fields={{ gameId: game.id }}
                          variant="secondary"
                          size="lg"
                          confirmMessage="Misturar os jogadores dos dois times e dividir novamente?"
                          icon={<Shuffle className="h-4 w-4" aria-hidden />}
                        >
                          Misturar times
                        </ActionButton>
                      </div>
                    ) : null}

                    {isAdmin && game.status === "IN_PROGRESS" ? (
                      <ActionButton
                        action={finalizeMatchAction}
                        fields={{ gameId: game.id }}
                        variant="success"
                        size="lg"
                        formClassName="w-full"
                        className="w-full justify-center rounded-xl py-3 font-bold shadow-[0_6px_16px_-10px_rgba(16,185,129,0.3)] transition active:scale-[0.99]"
                        confirmMessage="Finalizar a partida e rodar a fila automaticamente?"
                        icon={<Flag className="h-4 w-4" aria-hidden />}
                      >
                        Finalizar partida
                      </ActionButton>
                    ) : null}

                    {isAdmin && game.status === "IN_PROGRESS" ? (
                      <Disclosure title="Digitar placar" subtitle="Corrija o placar atual de uma vez">
                        <ActionForm
                          action={setScoreAction}
                          hiddenFields={{ gameId: game.id }}
                          submitLabel="Salvar placar"
                          variant="secondary"
                          size="sm"
                        >
                          <div key={`score-fields-${game.id}-${game.scoreA}-${game.scoreB}`} className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="scoreA">{game.teamAName}</Label>
                              <Input
                                id="scoreA"
                                name="scoreA"
                                type="number"
                                min={0}
                                max={999}
                                defaultValue={game.scoreA}
                                inputMode="numeric"
                              />
                            </div>
                            <div>
                              <Label htmlFor="scoreB">{game.teamBName}</Label>
                              <Input
                                id="scoreB"
                                name="scoreB"
                                type="number"
                                min={0}
                                max={999}
                                defaultValue={game.scoreB}
                                inputMode="numeric"
                              />
                            </div>
                          </div>
                        </ActionForm>
                      </Disclosure>
                    ) : null}

                    {isAdmin && game ? (
                      <Disclosure
                        title="Substituir jogador"
                        subtitle="Puxa alguém da fila e mantém o time completo"
                      >
                        <ActionForm
                          action={substitutePlayerAction}
                          hiddenFields={{ gameId: game.id }}
                          submitLabel="Confirmar substituição"
                          variant="secondary"
                          size="sm"
                        >
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="outUserId" required>
                                Quem sai
                              </Label>
                              <Select id="outUserId" name="outUserId" required>
                                {[...game.teamAPlayers, ...game.teamBPlayers].map((player) => (
                                  <option key={player.userId} value={player.userId}>
                                    {player.name}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="inUserId">Quem entra</Label>
                              <Select id="inUserId" name="inUserId" defaultValue="">
                                <option value="">Próximo da fila (automático)</option>
                                {view.queue.map((player) => (
                                  <option key={player.userId} value={player.userId}>
                                    {player.name} · {player.gamesPlayed} jogo(s)
                                  </option>
                                ))}
                              </Select>
                            </div>
                          </div>
                        </ActionForm>
                      </Disclosure>
                    ) : null}
                  </CardBody>
                </Card>
              ) : (
                <Alert tone="warning" title="Aguardando jogadores">
                  Faltam {view.missing} jogador(es) para montar a próxima partida. Marque a chegada de mais gente
                  na lista abaixo.
                </Alert>
              )}

              <Card data-testid="racha-queue">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(245,185,66,0.12)] text-warning">
                      <ListOrdered className="h-4 w-4" aria-hidden />
                    </span>
                    <CardTitle>Fila de espera</CardTitle>
                  </div>
                  <Badge tone="warning">{view.queue.length}</Badge>
                </CardHeader>
                <CardBody className="space-y-1.5 pt-2">
                  {view.queue.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted">
                      Ninguém na fila de espera no momento.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {queueGroups.map((group, groupIndex) => {
                        const complete = group.players.length >= teamSize;
                        return (
                          <div key={group.key} className="rounded-xl border border-line bg-surface-2/30 p-2">
                            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                {groupIndex + 1}º time reserva
                              </span>
                              <TeamPill name={group.visual.name} color={group.visual.color} />
                              {!complete ? <Badge tone="warning">Incompleto</Badge> : null}
                            </div>
                            <ul className="space-y-1">
                              {group.players.map((player) => {
                                const index = view.queue.findIndex((item) => item.userId === player.userId);
                                return (
                                  <li key={player.userId} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-warning-soft text-[10px] font-bold text-warning">
                                      #{index + 1}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                                      {player.name}
                                    </span>
                                    <span className="shrink-0 rounded-md bg-ink/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                                      {player.gamesPlayed}j
                                    </span>
                                    {isAdmin ? (
                                      <div className="flex items-center gap-0.5">
                                        <QueueSwapDialog
                                          attendanceId={player.attendanceId}
                                          playerName={player.name}
                                          players={view.queue.map((item, position) => ({
                                            attendanceId: item.attendanceId,
                                            name: item.name,
                                            position: position + 1,
                                          }))}
                                        />
                                        <ActionButton
                                          action={leaveRachaAction}
                                          fields={{ attendanceId: player.attendanceId }}
                                          variant="ghost"
                                          size="icon-sm"
                                          className="text-muted hover:bg-danger-soft hover:text-danger"
                                          confirmMessage={`Remover ${player.name} da fila?`}
                                          title="Remover da fila"
                                        >
                                          <LogOut className="h-4 w-4" aria-hidden />
                                        </ActionButton>
                                      </div>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>

              <Disclosure
                title={
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted" aria-hidden />
                    Lista do racha
                  </span>
                }
                subtitle={`${roster.confirmed.length} confirmados`}
                defaultOpen={false}
              >
                <div className="space-y-2">
                  {isAdmin ? (
                    <OrganizerToggle
                      eventId={selected.id}
                      attendanceId={myAttendance?.attendanceId}
                      isOrganizer={Boolean(myAttendance?.isOrganizer)}
                      isAdmin
                    />
                  ) : null}
                  <Alert tone="warning">
                    Marque <strong>Cheguei</strong> somente quando o jogador estiver no local do jogo. Só quem
                    marcar chegada entra na fila e nos times.
                  </Alert>
                  <ul className="divide-y divide-line/60">
                    {roster.confirmed.map((player) => (
                      <li key={player.attendanceId} className="flex items-center gap-2 py-2">
                        <Avatar
                          userId={player.userId}
                          name={player.name}
                          version={player.avatarUpdatedAt}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">{player.name}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted">
                            {onCourtIds.has(player.userId)
                              ? "Em quadra"
                              : player.rotationStatus === "WAITING"
                                ? "Na fila"
                                : player.rotationStatus === "LEFT"
                                  ? "Saiu"
                                  : player.checkedInAt
                                    ? "Presente"
                                    : "Não chegou"}
                            {player.gamesPlayed > 0 ? ` · ${player.gamesPlayed} jogo(s)` : ""}
                          </p>
                        </div>
                        {isAdmin || player.userId === user.id ? (
                          <div className="flex items-center gap-0.5">
                            {!player.checkedInAt || player.rotationStatus === "LEFT" ? (
                              <ActionButton
                                action={checkInAttendanceAction}
                                fields={{ attendanceId: player.attendanceId }}
                                variant="ghost"
                                size="icon-sm"
                                confirmTitle="Confirmar chegada"
                                confirmMessage={
                                  player.userId === user.id
                                    ? "Marque apenas se você já estiver no local do evento. Confirmar chegada?"
                                    : `Marcar chegada de ${player.name}? Confirme apenas se a pessoa já estiver no local.`
                                }
                                title={
                                  player.rotationStatus === "LEFT"
                                    ? "Voltar para a fila"
                                    : "Marcar chegada (somente no local)"
                                }
                              >
                                <LogIn className="h-3.5 w-3.5" aria-hidden />
                              </ActionButton>
                            ) : player.rotationStatus !== "PLAYING" ? (
                              <ActionButton
                                action={leaveRachaAction}
                                fields={{ attendanceId: player.attendanceId }}
                                variant="ghost"
                                size="icon-sm"
                                confirmMessage={`Marcar ${player.name} como saído?`}
                                title="Marcar saída"
                              >
                                <LogOut className="h-3.5 w-3.5" aria-hidden />
                              </ActionButton>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {isAdmin && roster.pending.length > 0 ? (
                    <Disclosure title="Adicionar jogador à lista" subtitle={`${roster.pending.length} jogador(es) sem resposta`}>
                      <ul className="grid gap-1 sm:grid-cols-2">
                        {roster.pending.map((player) => (
                          <li
                            key={player.userId}
                            className="flex items-center gap-2 rounded-lg px-1.5 py-1.5"
                          >
                            <Avatar
                              userId={player.userId}
                              name={player.name}
                              version={player.avatarUpdatedAt}
                              size="sm"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-muted">
                              {player.name}
                            </span>
                            <ActionButton
                              action={addToRachaAction}
                              fields={{ eventId: selected.id, userId: player.userId }}
                              variant="outline"
                              size="sm"
                              icon={<UserPlus className="h-3.5 w-3.5" aria-hidden />}
                            >
                              Adicionar
                            </ActionButton>
                          </li>
                        ))}
                      </ul>
                    </Disclosure>
                  ) : null}
                </div>
              </Disclosure>

              <Disclosure
                title={
                  <span className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-muted" aria-hidden />
                    Histórico do racha
                  </span>
                }
                subtitle={`${view.history.length} ${view.history.length === 1 ? "resultado" : "resultados"}`}
                defaultOpen={false}
              >
                <div className="space-y-2">
                  {view.history.length === 0 ? (
                    <p className="text-xs text-muted">Nenhum resultado ainda.</p>
                  ) : (
                    <ol className="space-y-1">
                      {view.history.map((match) => (
                        <li
                          key={match.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-line/60 px-2.5 py-1.5 text-sm"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            Q{match.court} · #{match.sequence}
                          </span>
                          <TeamPill name={match.teamAName} color={match.teamAColor} />
                          <span className="text-xs text-muted">
                            {match.scoreA} × {match.scoreB}
                          </span>
                          <TeamPill name={match.teamBName} color={match.teamBColor} />
                          <GameDurationBadge startedAt={match.startedAt} finishedAt={match.finishedAt} />
                          <span className="ml-auto text-xs text-muted">
                            venceu{" "}
                            <span className="font-semibold text-ink">
                              {match.winnerTeamId === match.teamAId ? match.teamAName : match.teamBName}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </Disclosure>

              {isAdmin ? (
                <div className="space-y-3">
                  {canUndoSelected ? (
                    <ActionButton
                      action={undoRachaAction}
                      fields={{ drawId: session.id }}
                      variant="secondary"
                      size="sm"
                      confirmMessage="Desfazer o último resultado?"
                      icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                    >
                      Desfazer último
                    </ActionButton>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <ActionButton
                      action={restartRachaAction}
                      fields={{ drawId: session.id }}
                      variant="secondary"
                      size="md"
                      formClassName="w-full"
                      className="w-full justify-center font-bold"
                      confirmMessage="Reiniciar o racha com a lista atual? O histórico anterior continua salvo."
                      icon={<Repeat className="h-3.5 w-3.5" aria-hidden />}
                    >
                      Reiniciar racha
                    </ActionButton>
                    <ActionButton
                      action={endRachaAction}
                      fields={{ drawId: session.id }}
                      variant="danger"
                      size="md"
                      formClassName="w-full"
                      className="w-full justify-center border-red-200/80 bg-red-50 font-bold text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
                      confirmMessage="Encerrar o racha? A partida atual precisa estar finalizada."
                      icon={<Flag className="h-3.5 w-3.5" aria-hidden />}
                    >
                      Encerrar racha
                    </ActionButton>
                  </div>
                </div>
              ) : null}
            </>
          )}

          <p className="text-center text-[11px] uppercase tracking-[0.16em] text-muted/60">
            {session
              ? `Sessão iniciada ${formatTime(session.createdAt, settings.timezone)} · ${teamSize} por time`
              : "Aguardando início do racha"}
          </p>
        </div>
      )}
    </div>
  );
}