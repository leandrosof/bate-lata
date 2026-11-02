import Link from "next/link";
import { ArrowRight, ClipboardList, Clock, ShieldAlert, Trophy } from "lucide-react";
import { correctResultAction } from "@/actions/games";
import { GameDurationBadge } from "@/components/features/game-duration";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { listAuditLogs } from "@/db/queries/audit";
import { getGameDurationStats, listFinishedGames } from "@/db/queries/games";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDateTime, formatDurationSeconds } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Resultados" };

export default async function AdminResultsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const [games, audit, durationStats] = await Promise.all([
    listFinishedGames(30),
    listAuditLogs(20),
    getGameDurationStats(),
  ]);
  const corrections = audit.filter((entry) => entry.action === "game.correct");
  const averageDuration = formatDurationSeconds(durationStats.averageSeconds);

  return (
    <div>
      <PageHeader
        eyebrow="Placares oficiais"
        title="Resultados"
        subtitle="Corrija partidas encerradas — o ranking é recalculado automaticamente."
        icon={<Trophy className="h-5 w-5" />}
      />

      <div className="mb-4 max-w-sm">
        <StatCard
          label="Duração média"
          value={averageDuration ?? "—"}
          hint={
            durationStats.count > 0
              ? `${durationStats.count} partida${durationStats.count === 1 ? "" : "s"} com tempo registrado`
              : "Sem partidas com duração registrada"
          }
          icon={<Clock className="h-4 w-4" />}
          accent="brand"
        />
      </div>

      <Alert tone="info" className="mb-4">
        Só partidas com status <strong>Encerrada</strong> entram no ranking. A correção mantém auditoria de quem
        alterou, quando e quais eram os valores anteriores.
      </Alert>

      {games.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="Nenhum resultado registrado"
          description="Encerre uma partida no placar ao vivo para começar o histórico."
          action={
            <Link href="/partidas" className={cn(buttonVariants({ size: "md" }))}>
              Ir para o placar
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {games.map((game) => (
            <Card key={game.id}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {game.teamAName} <span className="text-muted">×</span> {game.teamBName}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {game.eventTitle} ·{" "}
                      {game.finishedAt ? formatDateTime(game.finishedAt, settings.timezone) : "sem data"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-xl font-semibold tabular-nums text-ink">
                      {game.scoreA} <span className="text-muted/50">:</span> {game.scoreB}
                    </p>
                    <Link
                      href={`/partidas?jogo=${game.id}`}
                      className="text-brand transition hover:text-ink"
                      aria-label="Abrir partida"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Badge tone="success">
                    {game.winnerTeamId === game.teamAId ? game.teamAName : game.teamBName} venceu
                  </Badge>
                  <Badge>{game.teamAPlayers.length + game.teamBPlayers.length} jogadores</Badge>
                  <GameDurationBadge startedAt={game.startedAt} finishedAt={game.finishedAt} />
                  {game.source === "TEAM_ROTATION" ? <Badge tone="brand">Rotação</Badge> : null}
                </div>

                {game.source === "TEAM_ROTATION" ? (
                  <p className="text-[11px] text-muted">
                    Resultado registrado pela rotação de times. Para desfazer, use a tela de rotação.
                  </p>
                ) : (
                  <Disclosure title="Corrigir placar" subtitle="A alteração afeta o ranking" tone="danger">
                  <ActionForm
                    action={correctResultAction}
                    hiddenFields={{ gameId: game.id }}
                    submitLabel="Salvar correção"
                    variant="danger"
                    size="sm"
                    confirmMessage="Confirmar correção deste resultado?"
                  >
                    <div key={`result-fields-${game.id}-${game.scoreA}-${game.scoreB}`} className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`res-a-${game.id}`}>{game.teamAName}</Label>
                        <Input
                          id={`res-a-${game.id}`}
                          name="scoreA"
                          type="number"
                          min={0}
                          max={999}
                          defaultValue={game.scoreA}
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`res-b-${game.id}`}>{game.teamBName}</Label>
                        <Input
                          id={`res-b-${game.id}`}
                          name="scoreB"
                          type="number"
                          min={0}
                          max={999}
                          defaultValue={game.scoreB}
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted">
                      Participantes: {[...game.teamAPlayers, ...game.teamBPlayers].map((player) => player.name).join(", ")}
                    </p>
                  </ActionForm>
                </Disclosure>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Auditoria de correções</CardTitle>
          <ShieldAlert className="h-4 w-4 text-muted" aria-hidden />
        </CardHeader>
        <CardBody className="pt-2">
          {corrections.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">Nenhuma correção registrada.</p>
          ) : (
            <ul className="space-y-1.5">
              {corrections.map((entry) => {
                const details = entry.details as
                  | { before?: { scoreA: number; scoreB: number }; after?: { scoreA: number; scoreB: number } }
                  | null;
                return (
                  <li key={entry.id} className="rounded-lg border border-line/60 px-2.5 py-1.5 text-xs">
                    <p className="text-ink/90">
                      <span className="font-medium">{entry.actorName ?? "Sistema"}</span> corrigiu a partida{" "}
                      {details?.before
                        ? `${details.before.scoreA}×${details.before.scoreB} → ${details.after?.scoreA}×${details.after?.scoreB}`
                        : ""}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted">
                      {formatDateTime(entry.createdAt, settings.timezone)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
