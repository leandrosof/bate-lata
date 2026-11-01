import { teamVisualByColor } from "@/lib/teams";
import { cn } from "@/lib/utils";

export type TeamCardTeam = {
  id?: string;
  name: string;
  color: string;
  players: { userId: string; name: string }[];
};

export function TeamCard({
  team,
  teamSize,
  className,
  highlight,
}: {
  team: TeamCardTeam;
  teamSize?: number;
  className?: string;
  highlight?: boolean;
}) {
  const visual = teamVisualByColor(team.color);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-surface/80",
        highlight ? "border-white/25 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]" : "border-line",
        className,
      )}
    >
      <div className="h-1 w-full" style={{ backgroundColor: visual.hex }} />
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: visual.hex }} />
          <p className="truncate font-display text-lg font-semibold uppercase tracking-wide text-ink">
            {team.name}
          </p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: visual.soft, color: visual.hex }}
        >
          {team.players.length}
          {teamSize ? `/${teamSize}` : ""}
        </span>
      </div>
      <ol className="space-y-1 px-2 py-2.5">
        {team.players.map((player, index) => (
          <li
            key={player.userId}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-ink/90 transition hover:bg-white/[0.04]"
          >
            <span className="w-4 text-right text-[10px] font-bold text-muted/70">{index + 1}</span>
            <span className="truncate">{player.name}</span>
          </li>
        ))}
        {team.players.length === 0 ? <li className="px-2 py-1 text-xs text-muted">Sem jogadores</li> : null}
      </ol>
    </div>
  );
}

export function TeamPill({ name, color }: { name: string; color: string }) {
  const visual = teamVisualByColor(color);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ borderColor: `${visual.hex}55`, backgroundColor: visual.soft, color: visual.hex }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: visual.hex }} />
      {name}
    </span>
  );
}
