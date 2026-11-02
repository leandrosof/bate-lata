import { readableTextColor, teamVisualByColor } from "@/lib/teams";
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
  compact,
}: {
  team: TeamCardTeam;
  teamSize?: number;
  className?: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  const visual = teamVisualByColor(team.color);
  const foreground = readableTextColor(visual.hex);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        highlight
          ? "border-line-strong bg-surface-2/90 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.35)]"
          : "border-line bg-surface/60",
        className,
      )}
    >
      {/* Top subtle glow bar */}
      <div
        className="h-1.5 w-full shadow-[0_1px_6px]"
        style={{
          backgroundColor: visual.hex,
          color: visual.hex,
        }}
      />
      <div className={cn("flex items-center justify-between gap-2", compact ? "px-2.5 pt-2.5" : "px-3.5 pt-3")}>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{
              backgroundColor: visual.hex,
              boxShadow: `0 0 0 1px ${foreground}55, 0 0 8px ${visual.hex}`,
            }}
          />
          <p
            className={cn(
              "truncate font-display font-bold uppercase tracking-wider text-ink",
              compact ? "text-sm" : "text-base",
            )}
          >
            {team.name}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink"
          style={{ backgroundColor: visual.soft }}
        >
          {team.players.length}
          {teamSize ? `/${teamSize}` : ""}
        </span>
      </div>
      <ol className={cn(compact ? "space-y-1 px-2 py-2" : "space-y-1.5 px-3 py-3")}>
        {team.players.map((player, index) => (
          <li
            key={player.userId}
            className={cn(
              "flex items-center gap-2 rounded-xl bg-ink/[0.02] font-medium text-ink transition hover:bg-ink/[0.06]",
              compact ? "px-1.5 py-1.5 text-sm" : "gap-2.5 px-2.5 py-1.5 text-sm",
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink/5 text-[11px] font-bold text-muted">
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

export function TeamPill({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  const visual = teamVisualByColor(color);
  const ring = readableTextColor(visual.hex);
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold text-ink",
        className,
      )}
      style={{ borderColor: `${visual.hex}66`, backgroundColor: visual.soft }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          backgroundColor: visual.hex,
          boxShadow: `0 0 0 1px ${ring}66`,
        }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
