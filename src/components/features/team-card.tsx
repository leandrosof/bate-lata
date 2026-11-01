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
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        highlight
          ? "border-white/20 bg-surface-2/90 shadow-[0_12px_28px_-8px_rgba(0,0,0,0.6)]"
          : "border-line bg-surface/60",
        className,
      )}
    >
      {/* Top subtle glow bar */}
      <div
        className="h-1.5 w-full shadow-[0_2px_10px]"
        style={{
          backgroundColor: visual.hex,
          color: visual.hex,
        }}
      />
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_8px]"
            style={{ backgroundColor: visual.hex, color: visual.hex }}
          />
          <p className="truncate font-display text-base font-bold uppercase tracking-wider text-ink">
            {team.name}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: visual.soft, color: visual.hex }}
        >
          {team.players.length}
          {teamSize ? `/${teamSize}` : ""}
        </span>
      </div>
      <ol className="space-y-1.5 px-3 py-3">
        {team.players.map((player, index) => (
          <li
            key={player.userId}
            className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-2.5 py-1.5 text-sm font-medium text-ink transition hover:bg-white/[0.06]"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/5 text-[11px] font-bold text-muted">
              {index + 1}
            </span>
            <span className="truncate">{player.name}</span>
          </li>
        ))}
        {team.players.length === 0 ? (
          <li className="px-2 py-3 text-center text-xs text-muted">Sem jogadores escalados</li>
        ) : null}
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
