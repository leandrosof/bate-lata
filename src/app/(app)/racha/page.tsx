import Link from "next/link";
import {
  ArrowRight,
  Flag,
  ListOrdered,
  LogIn,
  LogOut,
  Minus,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { adjustScoreAction, setScoreAction } from "@/actions/games";
import {
  addToRachaAction,
  checkInRachaAction,
  endRachaAction,
  finalizeMatchAction,
  leaveRachaAction,
  restartRachaAction,
  startMatchAction,
  startRachaAction,
  substitutePlayerAction,
  undoRachaAction,
} from "@/actions/racha";
import { EventPicker } from "@/components/features/event-picker";
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
import { getSettings } from "@/lib/settings";
import { TEAM_SIZE_OPTIONS } from "@/lib/teams";
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

  const game = view?.currentGame ?? null;
  const session = view?.session ?? null;
  const teamSize = view?.teamSize ?? settings.defaultTeamSize;
  const sessionHours = view?.sessionAgeHours ?? 0;
  const onCourtIds = new Set(
    game ? [...game.teamAPlayers, ...game.teamBPlayers].map((player) => player.userId) : [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Jogos livres"
        title="Racha"
        subtitle="Lista única, times automáticos, placar e próximo jogo sem escolher time."
        icon={<Repeat className="h-5 w-5" />}
        action={session ? <DrawStatusBadge status={session.status} /> : undefined}
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
                    <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-white">
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
                    <div className="max-w-[200px]">
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
              {game ? (
                <Card data-testid="racha-current-game">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-[#9db8ff]">
                        <Trophy className="h-4 w-4" aria-hidden />
                      </span>
                      <CardTitle>
                        {game.status === "IN_PROGRESS" ? "Partida atual" : "Próxima partida"}
                      </CardTitle>
                    </div>
                    <Badge tone={game.status === "IN_PROGRESS" ? "live" : "warning"}>
                      {game.status === "IN_PROGRESS" ? "Ao vivo" : "Pronta"}
                    </Badge>
                  </CardHeader>
                  <CardBody className="space-y-3 pt-2">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                      <div className="space-y-2">
                        <TeamCard
                          team={{
                            name: game.teamAName,
                            color: game.teamAColor,
                            players: game.teamAPlayers,
                          }}
                          teamSize={teamSize}
                          highlight
                        />
                        <div className="flex items-center justify-center gap-1.5">
                          <p className="font-display text-4xl font-bold tabular-nums text-white" data-testid="racha-score-a">
                            {game.scoreA}
                          </p>
                          {isAdmin && game.status === "IN_PROGRESS" ? (
                            <>
                              <ActionButton
                                action={adjustScoreAction}
                                fields={{ gameId: game.id, side: "A", delta: 1 }}
                                variant="secondary"
                                size="icon"
                                title={`+1 ${game.teamAName}`}
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                              </ActionButton>
                              <ActionButton
                                action={adjustScoreAction}
                                fields={{ gameId: game.id, side: "A", delta: -1 }}
                                variant="ghost"
                                size="icon"
                                title={`-1 ${game.teamAName}`}
                              >
                                <Minus className="h-4 w-4" aria-hidden />
                              </ActionButton>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center py-4 font-display text-xs uppercase tracking-widest text-muted">
                        vs
                      </div>

                      <div className="space-y-2">
                        <TeamCard
                          team={{
                            name: game.teamBName,
                            color: game.teamBColor,
                            players: game.teamBPlayers,
                          }}
                          teamSize={teamSize}
                          highlight
                        />
                        <div className="flex items-center justify-center gap-1.5">
                          <p className="font-display text-4xl font-bold tabular-nums text-white" data-testid="racha-score-b">
                            {game.scoreB}
                          </p>
                          {isAdmin && game.status === "IN_PROGRESS" ? (
                            <>
                              <ActionButton
                                action={adjustScoreAction}
                                fields={{ gameId: game.id, side: "B", delta: 1 }}
                                variant="secondary"
                                size="icon"
                                title={`+1 ${game.teamBName}`}
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                              </ActionButton>
                              <ActionButton
                                action={adjustScoreAction}
                                fields={{ gameId: game.id, side: "B", delta: -1 }}
                                variant="ghost"
                                size="icon"
                                title={`-1 ${game.teamBName}`}
                              >
                                <Minus className="h-4 w-4" aria-hidden />
                              </ActionButton>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {isAdmin && game.status === "NOT_STARTED" ? (
                      <ActionButton
                        action={startMatchAction}
                        fields={{ gameId: game.id }}
                        variant="primary"
                        size="lg"
                        icon={<Play className="h-4 w-4" aria-hidden />}
                      >
                        Iniciar partida
                      </ActionButton>
                    ) : null}

                    {isAdmin && game.status === "IN_PROGRESS" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionButton
                          action={finalizeMatchAction}
                          fields={{ gameId: game.id }}
                          variant="success"
                          size="lg"
                          confirmMessage="Finalizar a partida e rodar a fila automaticamente?"
                          icon={<Flag className="h-4 w-4" aria-hidden />}
                        >
                          Finalizar partida
                        </ActionButton>
                      </div>
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
                          <div className="grid grid-cols-2 gap-3">
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
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(245,185,66,0.12)] text-[#fbd38d]">
                      <ListOrdered className="h-4 w-4" aria-hidden />
                    </span>
                    <CardTitle>Fila de espera</CardTitle>
                  </div>
                  <Badge tone="warning">{view.queue.length}</Badge>
                </CardHeader>
                <CardBody className="space-y-1.5 pt-2">
                  {view.queue.length === 0 ? (
                    <p className="text-xs text-muted">Ninguém aguardando.</p>
                  ) : (
                    <ol className="space-y-1">
                      {view.queue.map((player, index) => (
                        <li
                          key={player.userId}
                          className="flex items-center gap-2 rounded-lg border border-line/60 px-2.5 py-1.5"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(245,185,66,0.14)] text-[10px] font-bold text-[#fbd38d]">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{player.name}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted">
                            {player.gamesPlayed} jogo(s)
                          </span>
                          {isAdmin ? (
                            <ActionButton
                              action={leaveRachaAction}
                              fields={{ attendanceId: player.attendanceId }}
                              variant="ghost"
                              size="icon-sm"
                              confirmMessage={`Remover ${player.name} da fila?`}
                              title="Remover da fila"
                            >
                              <LogOut className="h-3.5 w-3.5" aria-hidden />
                            </ActionButton>
                          ) : null}
                        </li>
                      ))}
                    </ol>
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
                                action={checkInRachaAction}
                                fields={{ attendanceId: player.attendanceId }}
                                variant="ghost"
                                size="icon-sm"
                                title={player.rotationStatus === "LEFT" ? "Voltar para a fila" : "Marcar chegada"}
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
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico do racha</CardTitle>
                  <Badge>{view.history.length}</Badge>
                </CardHeader>
                <CardBody className="space-y-2 pt-2">
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
                            #{match.sequence}
                          </span>
                          <TeamPill name={match.teamAName} color={match.teamAColor} />
                          <span className="text-xs text-muted">
                            {match.scoreA} × {match.scoreB}
                          </span>
                          <TeamPill name={match.teamBName} color={match.teamBColor} />
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
                </CardBody>
              </Card>

              {isAdmin ? (
                <div className="flex flex-wrap gap-2">
                  {view.canUndo ? (
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
                  <ActionButton
                    action={restartRachaAction}
                    fields={{ drawId: session.id }}
                    variant="ghost"
                    size="sm"
                    confirmMessage="Reiniciar o racha com a lista atual? O histórico anterior continua salvo."
                    icon={<Repeat className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Reiniciar racha
                  </ActionButton>
                  <ActionButton
                    action={endRachaAction}
                    fields={{ drawId: session.id }}
                    variant="ghost"
                    size="sm"
                    confirmMessage="Encerrar o racha? A partida atual precisa estar finalizada."
                  >
                    Encerrar racha
                  </ActionButton>
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
