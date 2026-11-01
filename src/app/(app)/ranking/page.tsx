import Link from "next/link";
import { BarChart3, Crown, Medal, Settings, Trophy, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { LinkTabs } from "@/components/ui/tabs";
import { countGamesPlayed } from "@/db/queries/players";
import { getRanking } from "@/db/queries/ranking";
import { listSeasons } from "@/lib/settings";
import { requireUser } from "@/lib/auth";
import { getActiveSeason, getSettings } from "@/lib/settings";
import { currentMonthKey, formatMonthLabel, monthRange, recentMonthKeys } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Ranking" };

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const settings = await getSettings();
  const seasons = await listSeasons();
  const activeSeason = await getActiveSeason();
  const params = await searchParams;
  const isAdmin = user.role === "ADMIN";

  if (!settings.rankingEnabled) {
    return (
      <div>
        <PageHeader
          eyebrow="Estatísticas do grupo"
          title="Ranking"
          subtitle="Ranking geral, mensal e por temporada."
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Ranking desativado"
          description="O administrador desativou a exibição do ranking. Os resultados e o histórico continuam salvos e voltam a aparecer quando o ranking for reativado."
          action={
            isAdmin ? (
              <Link href="/admin/config" className={cn(buttonVariants({ size: "md" }))}>
                <Settings className="h-4 w-4" aria-hidden />
                Ativar no painel
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const period = params.periodo === "mensal" || params.periodo === "temporada" ? params.periodo : "geral";
  const months = recentMonthKeys(6, settings.timezone);
  const monthKey =
    typeof params.mes === "string" && months.includes(params.mes)
      ? params.mes
      : currentMonthKey(new Date(), settings.timezone);

  const seasonParam = typeof params.temporada === "string" ? params.temporada : undefined;
  const selectedSeason =
    seasons.find((season) => season.id === seasonParam) ?? activeSeason ?? seasons[0] ?? null;

  const range =
    period === "mensal"
      ? { from: monthRange(monthKey, settings.timezone).start, to: monthRange(monthKey, settings.timezone).end }
      : period === "temporada" && selectedSeason
        ? {
            from: selectedSeason.startsOn,
            to: selectedSeason.endsOn ? new Date(selectedSeason.endsOn.getTime() + 1) : null,
          }
        : { from: null, to: null };

  const [ranking, totalGames] = await Promise.all([
    getRanking(range, settings.pointsWin, settings.pointsLoss),
    countGamesPlayed(),
  ]);

  const leader = ranking[0] ?? null;
  const periodLabel =
    period === "mensal"
      ? formatMonthLabel(monthKey, settings.timezone)
      : period === "temporada" && selectedSeason
        ? selectedSeason.name
        : "Todo o histórico";

  const periodTabs = [
    { href: "/ranking?periodo=geral", label: "Geral", active: period === "geral" },
    { href: `/ranking?periodo=mensal&mes=${monthKey}`, label: "Mensal", active: period === "mensal" },
    { href: `/ranking?periodo=temporada${selectedSeason ? `&temporada=${selectedSeason.id}` : ""}`, label: "Temporada", active: period === "temporada" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Estatísticas do grupo"
        title="Ranking"
        subtitle={`${periodLabel} · ${settings.pointsWin} pts por vitória, ${settings.pointsLoss} por derrota`}
        icon={<BarChart3 className="h-5 w-5" />}
        action={
          isAdmin ? (
            <Link href="/admin/config" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              <Settings className="h-4 w-4" aria-hidden />
              Regras
            </Link>
          ) : undefined
        }
      />

      <LinkTabs items={periodTabs} className="mb-3" />

      {period === "mensal" ? (
        <LinkTabs
          className="mb-4"
          items={months.map((month) => ({
            href: `/ranking?periodo=mensal&mes=${month}`,
            label: formatMonthLabel(month, settings.timezone).split(" de ")[0] ?? month,
            active: month === monthKey,
          }))}
        />
      ) : null}

      {period === "temporada" ? (
        seasons.length === 0 ? (
          <Alert tone="warning" className="mb-4">
            Nenhuma temporada cadastrada. {isAdmin ? "Crie uma em Administração > Configurações." : "Fale com o administrador."}
          </Alert>
        ) : (
          <LinkTabs
            className="mb-4"
            items={seasons.map((season) => ({
              href: `/ranking?periodo=temporada&temporada=${season.id}`,
              label: season.isActive ? `${season.name} (ativa)` : season.name,
              active: season.id === selectedSeason?.id,
            }))}
          />
        )
      ) : null}

      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatCard
          label="Jogadores"
          value={ranking.length}
          icon={<Users className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Partidas"
          value={totalGames}
          icon={<Trophy className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label="Líder"
          value={leader ? leader.points : "—"}
          hint={leader ? leader.name.split(" ")[0] : "sem partidas"}
          icon={<Crown className="h-4 w-4" />}
          accent="warning"
        />
      </div>

      {ranking.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Sem partidas neste período"
          description="O ranking é calculado automaticamente a partir de partidas encerradas com resultado confirmado."
          action={
            <Link href="/historico" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
              Ver histórico
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Classificação</CardTitle>
            <Badge tone="brand">{periodLabel}</Badge>
          </CardHeader>
          <CardBody className="pt-2">
            <div className="hidden grid-cols-[32px_1fr_52px_52px_52px_64px] gap-2 px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted sm:grid">
              <span>#</span>
              <span>Jogador</span>
              <span className="text-center">J</span>
              <span className="text-center">V</span>
              <span className="text-center">D</span>
              <span className="text-right">Pontos</span>
            </div>
            <ol className="divide-y divide-line/60">
              {ranking.map((entry) => {
                const isMe = entry.userId === user.id;
                return (
                  <li
                    key={entry.userId}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-2.5 sm:grid sm:grid-cols-[32px_1fr_52px_52px_52px_64px] sm:gap-2",
                      isMe && "rounded-xl bg-brand/10",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        entry.position === 1
                          ? "bg-[rgba(245,185,66,0.18)] text-[#fbd38d]"
                          : entry.position === 2
                            ? "bg-white/10 text-white"
                            : entry.position === 3
                              ? "bg-[rgba(249,115,22,0.16)] text-[#fdba74]"
                              : "text-muted",
                      )}
                    >
                      {entry.position === 1 ? <Crown className="h-3.5 w-3.5" aria-hidden /> : entry.position}
                    </span>

                    <Link href={`/jogadores/${entry.userId}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                      <Avatar
                        userId={entry.userId}
                        name={entry.name}
                        version={entry.avatarUpdatedAt}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {entry.name}
                          {isMe ? (
                            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7fa2ff]">
                              você
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[11px] text-muted sm:hidden">
                          {entry.played}J · {entry.wins}V · {entry.winRate}% aproveitamento
                        </span>
                        <span className="hidden text-[11px] text-muted sm:block">
                          {entry.nickname ? `@${entry.nickname}` : `${entry.winRate}% de aproveitamento`}
                        </span>
                      </span>
                    </Link>

                    <span className="hidden text-center text-sm tabular-nums text-muted sm:block">{entry.played}</span>
                    <span className="hidden text-center text-sm tabular-nums text-[#86efac] sm:block">{entry.wins}</span>
                    <span className="hidden text-center text-sm tabular-nums text-muted sm:block">{entry.losses}</span>
                    <span className="ml-auto text-right sm:ml-0">
                      <span className="font-display text-lg font-semibold tabular-nums text-white">{entry.points}</span>
                      <span className="block text-[9px] uppercase tracking-wider text-muted sm:hidden">pts</span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/40 p-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <Medal className="h-3.5 w-3.5 text-[#fbd38d]" aria-hidden />
                Pontuação: {settings.pointsWin} por vitória + {settings.pointsLoss} por derrota
              </span>
              <span>Empates não são permitidos em partidas oficiais</span>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
