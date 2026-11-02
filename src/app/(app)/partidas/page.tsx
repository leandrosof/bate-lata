import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Flame,
  History,
  Minus,
  Plus,
  RotateCcw,
  Trophy,
  Wifi,
} from "lucide-react";
import { adjustScoreAction, cancelGameAction, finishGameAction, correctResultAction, setScoreAction } from "@/actions/games";
import { AutoRefresh } from "@/components/features/auto-refresh";
import { GameStatusBadge } from "@/components/features/status-badge";
import { TeamPill } from "@/components/features/team-card";
import { ActionButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, SectionTitle } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { getGameDetail, listLiveGames, listRecentFinishedGames } from "@/db/queries/games";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { teamVisualByColor } from "@/lib/teams";
import { formatDateShort, formatDateTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Partidas e placares" };

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const settings = await getSettings();
  const params = await searchParams;
  const gameId = typeof params.jogo === "string" ? params.jogo : undefined;
  const isAdmin = user.role === "ADMIN";

  if (gameId) {
    const detail = await getGameDetail(gameId);

    if (!detail) {
      return (
        <div>
          <PageHeader
            backHref="/partidas"
            title="Partida não encontrada"
            subtitle="Ela pode ter sido removida ou o link está incorreto."
          />
          <EmptyState
            icon={<Trophy className="h-5 w-5" />}
            title="Nada por aqui"
            action={
              <Link href="/partidas" className={cn(buttonVariants({ size: "md" }))}>
                Voltar para partidas
              </Link>
            }
          />
        </div>
      );
    }

    const { game, scoreLog } = detail;
    const teamAVisual = teamVisualByColor(game.teamAColor);
    const teamBVisual = teamVisualByColor(game.teamBColor);
    const isLive = game.status === "IN_PROGRESS";
    const winnerName =
      game.winnerTeamId === game.teamAId
        ? game.teamAName
        : game.winnerTeamId === game.teamBId
          ? game.teamBName
          : null;

    return (
      <div>
        <PageHeader
          backHref="/partidas"
          eyebrow={formatDateTime(game.eventStartsAt, settings.timezone)}
          title={isLive ? "Partida ao vivo" : game.status === "FINISHED" ? "Resultado" : "Partida"}
          subtitle={game.eventTitle}
          icon={<Trophy className="h-5 w-5" />}
          action={<GameStatusBadge status={game.status} />}
        />

        {isLive ? <AutoRefresh intervalMs={12000} /> : null}

        <div className="space-y-4">
          <Card data-testid="scoreboard">
            <CardBody className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-5">
                <div className="text-right">
                  <p className="mb-1 flex justify-end">
                    <TeamPill name={game.teamAName} color={game.teamAColor} />
                  </p>
                  <p
                    className="font-display text-6xl font-bold leading-none tabular-nums sm:text-7xl"
                    style={{ color: teamAVisual.hex }}
                    data-testid="score-a"
                  >
                    {game.scoreA}
                  </p>
                  {isAdmin && isLive && game.source !== "RACHA" ? (
                    <div className="mt-2 flex justify-end gap-1.5">
                      <ActionButton
                        action={adjustScoreAction}
                        fields={{ gameId: game.id, side: "A", delta: 1 }}
                        variant="secondary"
                        size="icon"
                        title={`+1 para ${game.teamAName}`}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </ActionButton>
                      <ActionButton
                        action={adjustScoreAction}
                        fields={{ gameId: game.id, side: "A", delta: -1 }}
                        variant="ghost"
                        size="icon"
                        title={`-1 para ${game.teamAName}`}
                      >
                        <Minus className="h-4 w-4" aria-hidden />
                      </ActionButton>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="font-display text-sm uppercase tracking-widest text-muted">vs</span>
                  {isLive ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-danger">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f05252]" />
                      ao vivo
                    </span>
                  ) : null}
                </div>

                <div>
                  <p className="mb-1">
                    <TeamPill name={game.teamBName} color={game.teamBColor} />
                  </p>
                  <p
                    className="font-display text-6xl font-bold leading-none tabular-nums sm:text-7xl"
                    style={{ color: teamBVisual.hex }}
                    data-testid="score-b"
                  >
                    {game.scoreB}
                  </p>
                  {isAdmin && isLive && game.source !== "RACHA" ? (
                    <div className="mt-2 flex gap-1.5">
                      <ActionButton
                        action={adjustScoreAction}
                        fields={{ gameId: game.id, side: "B", delta: 1 }}
                        variant="secondary"
                        size="icon"
                        title={`+1 para ${game.teamBName}`}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </ActionButton>
                      <ActionButton
                        action={adjustScoreAction}
                        fields={{ gameId: game.id, side: "B", delta: -1 }}
                        variant="ghost"
                        size="icon"
                        title={`-1 para ${game.teamBName}`}
                      >
                        <Minus className="h-4 w-4" aria-hidden />
                      </ActionButton>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Início {game.startedAt ? formatTime(game.startedAt, settings.timezone) : "—"}
                </span>
                {game.finishedAt ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Fim {formatTime(game.finishedAt, settings.timezone)}
                  </span>
                ) : null}
                <span className="flex items-center gap-1.5">
                  <Wifi className="h-3.5 w-3.5" aria-hidden />
                  Placar salvo automaticamente
                </span>
              </div>

              {game.status === "FINISHED" && winnerName ? (
                <Alert tone="success" title={`${winnerName} venceu!`}>
                  Resultado confirmado e contabilizado no histórico e no ranking.
                </Alert>
              ) : null}

              {game.status === "CANCELLED" ? (
                <Alert tone="warning">Esta partida foi cancelada e não conta para as estatísticas.</Alert>
              ) : null}

              <div className="flex flex-wrap items-center justify-center gap-2">
                {isAdmin && isLive && game.source !== "RACHA" ? (
                  <>
                    <ActionButton
                      action={finishGameAction}
                      fields={{ gameId: game.id }}
                      variant="success"
                      size="lg"
                      confirmMessage="Encerrar a partida e confirmar o resultado?"
                      icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                    >
                      Encerrar partida
                    </ActionButton>
                    <ActionButton
                      action={cancelGameAction}
                      fields={{ gameId: game.id }}
                      variant="danger"
                      size="md"
                      confirmMessage="Cancelar esta partida? O placar não será contabilizado."
                      icon={<Ban className="h-4 w-4" aria-hidden />}
                    >
                      Cancelar
                    </ActionButton>
                  </>
                ) : null}
                <Link href="/racha" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
                  Ir para o racha
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                {game.status === "FINISHED" ? (
                  <Link href="/historico" className={cn(buttonVariants({ variant: "ghost", size: "md" }))}>
                    <History className="h-4 w-4" aria-hidden />
                    Histórico
                  </Link>
                ) : null}
              </div>
            </CardBody>
          </Card>


          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: game.teamAName, hex: teamAVisual.hex, players: game.teamAPlayers },
              { name: game.teamBName, hex: teamBVisual.hex, players: game.teamBPlayers },
            ].map((team) => (
              <Card key={team.name}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.hex }} />
                    {team.name}
                  </CardTitle>
                  <Badge>{team.players.length} jogadores</Badge>
                </CardHeader>
                <CardBody className="pt-2">
                  <ul className="flex flex-wrap gap-1.5">
                    {team.players.map((player) => (
                      <li
                        key={player.userId}
                        className="rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-xs text-ink/90"
                      >
                        {player.name}
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ))}
          </div>

          {isAdmin && isLive && game.source !== "RACHA" ? (
            <Disclosure title="Corrigir placar manualmente" subtitle="Use se o placar ficou dessincronizado">
              <ActionForm
                action={setScoreAction}
                hiddenFields={{ gameId: game.id }}
                submitLabel="Salvar placar"
                variant="secondary"
                size="md"
                submitIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
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

          {isAdmin && game.status === "FINISHED" && game.source === "MANUAL" ? (
            <Disclosure
              title="Corrigir resultado oficial"
              subtitle="A alteração recalcula as estatísticas de todos os jogadores"
              tone="danger"
            >
              <ActionForm
                action={correctResultAction}
                hiddenFields={{ gameId: game.id }}
                submitLabel="Salvar correção"
                variant="danger"
                confirmMessage="Corrigir este resultado já registrado?"
                submitIcon={<Flame className="h-4 w-4" aria-hidden />}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="correctionA">{game.teamAName}</Label>
                    <Input
                      id="correctionA"
                      name="scoreA"
                      type="number"
                      min={0}
                      max={999}
                      defaultValue={game.scoreA}
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label htmlFor="correctionB">{game.teamBName}</Label>
                    <Input
                      id="correctionB"
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

          {scoreLog.length > 0 ? (
            <Disclosure title="Histórico do placar" subtitle={`${scoreLog.length} alterações registradas`}>
              <ul className="space-y-1.5">
                {scoreLog.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line/60 px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-muted">
                      {formatTime(entry.createdAt, settings.timezone)} ·{" "}
                      {entry.side === "A" ? game.teamAName : game.teamBName}{" "}
                      <span className={entry.delta > 0 ? "text-success" : "text-danger"}>
                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                      </span>
                    </span>
                    <span className="font-display tabular-nums text-ink">
                      {entry.scoreA} × {entry.scoreB}
                    </span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          ) : null}

          <p className="text-center text-[11px] uppercase tracking-[0.16em] text-muted/60">
            {formatDateShort(game.createdAt, settings.timezone)} · {settings.siteName}
          </p>
        </div>
      </div>
    );
  }

  const liveGames = await listLiveGames();
  const recent = await listRecentFinishedGames(6);

  return (
    <div>
      <PageHeader
        eyebrow="Placar ao vivo"
        title="Partidas"
        subtitle="Acompanhe a partida em andamento e confira os últimos resultados."
        icon={<Trophy className="h-5 w-5" />}
        action={
          <Link href="/racha" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            Racha
          </Link>
        }
      />

      {liveGames.length > 0 ? <AutoRefresh intervalMs={15000} /> : null}

      {liveGames.length === 0 && recent.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title="Nenhuma partida registrada"
          description="Inicie um racha para gerar as partidas automaticamente."
          action={
            <Link href="/racha" className={cn(buttonVariants({ size: "md" }))}>
              Ir para o racha
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {liveGames.length > 0 ? (
            <section>
              <SectionTitle title="Ao vivo" subtitle="Atualiza automaticamente a cada 15 segundos" />
              <div className="stagger space-y-2">
                {liveGames.map((game) => (
                  <Link
                    key={game.id}
                    href={`/partidas?jogo=${game.id}`}
                    className="card group block p-4 transition hover:border-[rgba(240,82,82,0.35)]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <GameStatusBadge status={game.status} />
                      <span className="text-[11px] uppercase tracking-wider text-muted">
                        {game.eventTitle} · {formatTime(game.startedAt ?? game.createdAt, settings.timezone)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="flex justify-end">
                        <TeamPill name={game.teamAName} color={game.teamAColor} />
                      </div>
                      <p className="font-display text-3xl font-bold tabular-nums text-ink">
                        {game.scoreA}
                        <span className="mx-1.5 text-muted/50">:</span>
                        {game.scoreB}
                      </p>
                      <div>
                        <TeamPill name={game.teamBName} color={game.teamBColor} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {recent.length > 0 ? (
            <section>
              <SectionTitle
                title="Últimos resultados"
                subtitle="Partidas encerradas e confirmadas"
                action={
                  <Link href="/historico" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    Ver tudo
                  </Link>
                }
              />
              <div className="space-y-2">
                {recent.map((game) => (
                  <Link
                    key={game.id}
                    href={`/partidas?jogo=${game.id}`}
                    className="card flex items-center gap-3 p-3.5 transition hover:border-line-strong"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {game.teamAName} <span className="text-muted">vs</span> {game.teamBName}
                      </p>
                      <p className="text-[11px] text-muted">
                        {game.eventTitle} · {formatDateShort(game.finishedAt ?? game.createdAt, settings.timezone)}
                      </p>
                    </div>
                    <p className="font-display text-xl font-semibold tabular-nums text-ink">
                      {game.scoreA} <span className="text-muted/50">:</span> {game.scoreB}
                    </p>
                    <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}