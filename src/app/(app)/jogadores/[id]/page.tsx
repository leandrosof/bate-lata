import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Pencil, Trophy, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { listPlayerGames } from "@/db/queries/games";
import { getPublicPlayer } from "@/db/queries/players";
import { getPlayerRankingEntry } from "@/db/queries/ranking";
import { requireUser } from "@/lib/auth";
import { getActiveSeason, getSettings } from "@/lib/settings";
import { currentMonthKey, formatDateShort, formatDateLong, monthRange } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Perfil do jogador" };

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireUser();
  const settings = await getSettings();
  const { id } = await params;

  const player = await getPublicPlayer(id);
  if (!player) notFound();

  const activeSeason = await getActiveSeason();
  const month = monthRange(currentMonthKey(new Date(), settings.timezone), settings.timezone);

  const [overall, monthly, seasonal, games] = await Promise.all([
    getPlayerRankingEntry(player.id, { from: null, to: null }, settings.pointsWin, settings.pointsLoss),
    getPlayerRankingEntry(player.id, { from: month.start, to: month.end }, settings.pointsWin, settings.pointsLoss),
    activeSeason
      ? getPlayerRankingEntry(
          player.id,
          {
            from: activeSeason.startsOn,
            to: activeSeason.endsOn ? new Date(activeSeason.endsOn.getTime() + 1) : null,
          },
          settings.pointsWin,
          settings.pointsLoss,
        )
      : Promise.resolve({ entry: null, totalPlayers: 0 }),
    listPlayerGames(player.id, 8),
  ]);

  const stats = overall.entry;
  const isSelf = currentUser.id === player.id;

  return (
    <div>
      <PageHeader
        backHref="/jogadores"
        backLabel="Jogadores"
        eyebrow={player.role === "ADMIN" ? "Administrador" : "Jogador"}
        title={player.name}
        subtitle={`No grupo desde ${formatDateLong(player.createdAt, settings.timezone)}`}
        icon={<UserRound className="h-5 w-5" />}
        action={
          isSelf ? (
            <Link href="/perfil" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <Card>
          <CardBody className="flex flex-wrap items-center gap-4">
            <Avatar userId={player.id} name={player.name} version={player.avatarUpdatedAt} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
                  {player.name}
                </h2>
                {player.role === "ADMIN" ? <Badge tone="brand">Admin</Badge> : null}
                {!player.active ? <Badge tone="danger">Inativo</Badge> : null}
              </div>
              {player.nickname ? <p className="text-sm text-muted">@{player.nickname}</p> : null}
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>{stats?.played ?? 0} partidas disputadas</span>
                <span>{stats?.winRate ?? 0}% de aproveitamento</span>
                {stats ? <span>#{stats.position} no ranking geral</span> : null}
              </p>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Partidas" value={stats?.played ?? 0} icon={<Trophy className="h-4 w-4" />} accent="brand" />
          <StatCard label="Vitórias" value={stats?.wins ?? 0} icon={<Trophy className="h-4 w-4" />} accent="success" />
          <StatCard label="Derrotas" value={stats?.losses ?? 0} icon={<Trophy className="h-4 w-4" />} accent="danger" />
          <StatCard
            label="Aproveitamento"
            value={`${stats?.winRate ?? 0}%`}
            icon={<Trophy className="h-4 w-4" />}
            accent="warning"
          />
        </div>

        {settings.rankingEnabled ? (
          <Card>
            <CardHeader>
              <CardTitle>Posições no ranking</CardTitle>
              <Badge tone="brand">
                {settings.pointsWin} pts/vitória · {settings.pointsLoss} pts/derrota
              </Badge>
            </CardHeader>
            <CardBody className="grid grid-cols-3 gap-2 pt-2">
              {[
                { label: "Geral", entry: overall.entry, total: overall.totalPlayers },
                { label: "No mês", entry: monthly.entry, total: monthly.totalPlayers },
                {
                  label: activeSeason?.name ?? "Temporada",
                  entry: seasonal.entry,
                  total: seasonal.totalPlayers,
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-surface-2/40 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-ink">
                    {item.entry ? `#${item.entry.position}` : "—"}
                  </p>
                  <p className="text-[10px] text-muted">
                    {item.entry ? `${item.entry.points} pts` : "sem jogos"}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Últimos jogos</CardTitle>
            <Link href="/historico" className="text-xs font-semibold text-brand hover:text-ink">
              Histórico
            </Link>
          </CardHeader>
          <CardBody className="pt-2">
            {games.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="Nenhuma partida registrada"
                description="As partidas encerradas com este jogador aparecem aqui."
              />
            ) : (
              <ul className="divide-y divide-line/60">
                {games.map((game) => {
                  const inTeamA = game.teamAPlayers.some((member) => member.userId === player.id);
                  const myTeamId = inTeamA ? game.teamAId : game.teamBId;
                  const won = game.winnerTeamId === myTeamId;
                  return (
                    <li key={game.id}>
                      <Link
                        href={`/partidas?jogo=${game.id}`}
                        className="flex items-center gap-2 py-2.5 transition hover:bg-ink/[0.02]"
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            won
                              ? "bg-[rgba(34,197,94,0.14)] text-success"
                              : "bg-[rgba(240,82,82,0.12)] text-danger",
                          )}
                        >
                          {won ? "V" : "D"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">
                            {game.teamAName} {game.scoreA} × {game.scoreB} {game.teamBName}
                          </p>
                          <p className="truncate text-[11px] text-muted">
                            {game.eventTitle} ·{" "}
                            {formatDateShort(game.finishedAt ?? game.createdAt, settings.timezone)}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="flex justify-center">
          <Link href="/jogadores" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Todos os jogadores
          </Link>
        </div>
      </div>
    </div>
  );
}
