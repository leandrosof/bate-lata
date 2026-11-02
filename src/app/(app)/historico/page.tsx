import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, History, Trophy } from "lucide-react";
import { correctResultAction } from "@/actions/games";
import { GameDurationBadge } from "@/components/features/game-duration";
import { GameStatusBadge } from "@/components/features/status-badge";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { listFinishedGames } from "@/db/queries/games";
import { countGamesPlayed } from "@/db/queries/players";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { teamVisualByColor } from "@/lib/teams";
import { formatDateLong, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Histórico" };

const PAGE_SIZE = 20;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const settings = await getSettings();
  const params = await searchParams;
  const isAdmin = user.role === "ADMIN";

  const pageParam = typeof params.pagina === "string" ? Number(params.pagina) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const [games, total] = await Promise.all([
    listFinishedGames(PAGE_SIZE, (page - 1) * PAGE_SIZE),
    countGamesPlayed(),
  ]);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div>
      <PageHeader
        eyebrow="Tudo fica registrado"
        title="Histórico"
        subtitle={`${total} ${total === 1 ? "partida encerrada" : "partidas encerradas"} no grupo.`}
        icon={<History className="h-5 w-5" />}
        action={
          <Link href="/partidas" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            Placar ao vivo
          </Link>
        }
      />

      {games.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Nenhuma partida encerrada ainda"
          description="Assim que uma partida for finalizada com o placar confirmado, ela aparece aqui."
          action={
            <Link href="/racha" className={cn(buttonVariants({ size: "md" }))}>
              Abrir racha
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {games.map((game) => {
            const teamAVisual = teamVisualByColor(game.teamAColor);
            const teamBVisual = teamVisualByColor(game.teamBColor);
            const aWon = game.winnerTeamId === game.teamAId;
            const bWon = game.winnerTeamId === game.teamBId;

            return (
              <Card key={game.id}>
                <CardHeader className="items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{game.eventTitle}</CardTitle>
                      <GameStatusBadge status={game.status} />
                      <GameDurationBadge startedAt={game.startedAt} finishedAt={game.finishedAt} />
                      {game.source === "TEAM_ROTATION" ? <Badge tone="brand">Rotação</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">
                      {game.finishedAt
                        ? `${formatDateLong(game.finishedAt, settings.timezone)} · ${formatTime(game.finishedAt, settings.timezone)}`
                        : "Sem data de término"}
                    </p>
                  </div>
                  <Link
                    href={`/partidas?jogo=${game.id}`}
                    className="text-xs font-semibold text-brand hover:text-ink"
                  >
                    Detalhes
                  </Link>
                </CardHeader>
                <CardBody className="space-y-3 pt-2">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className={cn("min-w-0 text-right", aWon ? "text-ink" : "text-muted")}>
                      <p className="truncate text-sm font-semibold">{game.teamAName}</p>
                      <p
                        className="font-display text-3xl font-bold tabular-nums"
                        style={{ color: aWon ? teamAVisual.hex : undefined }}
                      >
                        {game.source === "TEAM_ROTATION" ? "—" : game.scoreA}
                      </p>
                      {aWon ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-success">
                          <Trophy className="h-3 w-3" aria-hidden /> vencedor
                        </span>
                      ) : null}
                    </div>
                    <span className="font-display text-xs uppercase tracking-widest text-muted">vs</span>
                    <div className={cn("min-w-0", bWon ? "text-ink" : "text-muted")}>
                      <p className="truncate text-sm font-semibold">{game.teamBName}</p>
                      <p
                        className="font-display text-3xl font-bold tabular-nums"
                        style={{ color: bWon ? teamBVisual.hex : undefined }}
                      >
                        {game.source === "TEAM_ROTATION" ? "—" : game.scoreB}
                      </p>
                      {bWon ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-success">
                          <Trophy className="h-3 w-3" aria-hidden /> vencedor
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-line/70 bg-surface-2/40 p-2.5 sm:grid-cols-2">
                    <p className="text-[11px] leading-relaxed text-muted">
                      <span className="font-semibold" style={{ color: teamAVisual.hex }}>
                        {game.teamAName}:
                      </span>{" "}
                      {game.teamAPlayers.map((player) => player.name).join(", ") || "sem jogadores"}
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted">
                      <span className="font-semibold" style={{ color: teamBVisual.hex }}>
                        {game.teamBName}:
                      </span>{" "}
                      {game.teamBPlayers.map((player) => player.name).join(", ") || "sem jogadores"}
                    </p>
                  </div>

                  {isAdmin && game.source !== "TEAM_ROTATION" ? (
                    <Disclosure
                      title="Corrigir placar"
                      subtitle="Só administradores · recalcula o ranking"
                      tone="danger"
                    >
                      <ActionForm
                        action={correctResultAction}
                        hiddenFields={{ gameId: game.id }}
                        submitLabel="Salvar correção"
                        variant="danger"
                        size="sm"
                        confirmMessage="Corrigir este resultado? As estatísticas serão recalculadas."
                      >
                        <div key={`result-fields-${game.id}-${game.scoreA}-${game.scoreB}`} className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`a-${game.id}`}>{game.teamAName}</Label>
                            <Input
                              id={`a-${game.id}`}
                              name="scoreA"
                              type="number"
                              min={0}
                              max={999}
                              defaultValue={game.scoreA}
                              inputMode="numeric"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`b-${game.id}`}>{game.teamBName}</Label>
                            <Input
                              id={`b-${game.id}`}
                              name="scoreB"
                              type="number"
                              min={0}
                              max={999}
                              defaultValue={game.scoreB}
                              inputMode="numeric"
                            />
                          </div>
                        </div>
                        <Alert tone="warning">
                          Um empate não é permitido. O vencedor é definido pelo maior placar.
                        </Alert>
                      </ActionForm>
                    </Disclosure>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}

          {totalPages > 1 ? (
            <nav className="flex items-center justify-between gap-2 pt-2" aria-label="Paginação">
              <Link
                href={`/historico?pagina=${Math.max(page - 1, 1)}`}
                aria-disabled={page <= 1}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  page <= 1 && "pointer-events-none opacity-40",
                )}
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Anterior
              </Link>
              <span className="text-xs text-muted">
                Página {page} de {totalPages}
              </span>
              <Link
                href={`/historico?pagina=${Math.min(page + 1, totalPages)}`}
                aria-disabled={page >= totalPages}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  page >= totalPages && "pointer-events-none opacity-40",
                )}
              >
                Próxima
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}
