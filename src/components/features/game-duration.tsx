import { Clock } from "lucide-react";
import { formatGameDuration } from "@/lib/time";
import { cn } from "@/lib/utils";

export function GameDurationBadge({
  startedAt,
  finishedAt,
  live = false,
  className,
}: {
  startedAt: Date | null | undefined;
  finishedAt: Date | null | undefined;
  live?: boolean;
  className?: string;
}) {
  const duration = formatGameDuration(startedAt, finishedAt);
  if (!duration) return null;

  return (
    <span
      title={live ? "Tempo em andamento" : "Duração da partida"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-surface-2/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted",
        className,
      )}
    >
      <Clock className="h-3 w-3" aria-hidden />
      {live ? `Há ${duration}` : duration}
    </span>
  );
}
