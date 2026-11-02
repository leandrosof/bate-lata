import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { listPlayersWithStats } from "@/db/queries/players";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "Jogadores" };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const settings = await getSettings();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const players = await listPlayersWithStats(settings.pointsWin, settings.pointsLoss);
  const normalized = query.toLowerCase();
  const filtered = normalized
    ? players.filter(
        (player) =>
          player.name.toLowerCase().includes(normalized) ||
          (player.nickname ?? "").toLowerCase().includes(normalized),
      )
    : players;

  return (
    <div>
      <PageHeader
        eyebrow={`${players.length} ${players.length === 1 ? "jogador ativo" : "jogadores ativos"}`}
        title="Jogadores"
        subtitle="Perfis, estatísticas e histórico individual de cada jogador."
        icon={<Users className="h-5 w-5" />}
      />

      <form action="/jogadores" method="get" className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Buscar jogador ou apelido"
            className="pl-9"
            aria-label="Buscar jogador"
          />
        </div>
        <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
          Buscar
        </button>
      </form>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Nenhum jogador encontrado"
          description={query ? `Nada para "${query}". Tente outro nome.` : "Ainda não há jogadores ativos."}
        />
      ) : (
        <div className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((player) => (
            <Link key={player.id} href={`/jogadores/${player.id}`} className="card group block p-3 transition hover:border-brand/35">
              <CardBody className="flex items-center gap-3 p-0">
                <Avatar userId={player.id} name={player.name} version={player.avatarUpdatedAt} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{player.name}</p>
                  <p className="truncate text-[11px] text-muted">
                    {player.nickname ? `@${player.nickname}` : `${player.played} jogos`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {player.played}J · {player.wins}V · {player.winRate}%
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {player.position ? <Badge tone="brand">#{player.position}</Badge> : null}
                  <span className="font-display text-lg font-semibold tabular-nums text-ink">{player.points}</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted">pts</span>
                </div>
              </CardBody>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
