import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  accent?: "brand" | "success" | "warning" | "danger" | "neutral";
}) {
  const accents = {
    brand: "text-[#9db8ff] bg-brand-soft",
    success: "text-[#86efac] bg-[rgba(34,197,94,0.12)]",
    warning: "text-[#fbd38d] bg-[rgba(245,185,66,0.12)]",
    danger: "text-[#ff9a9a] bg-[rgba(240,82,82,0.12)]",
    neutral: "text-muted bg-surface-2",
  } as const;

  return (
    <div className={cn("card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
        {icon ? (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accents[accent ?? "neutral"])}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold leading-none text-ink">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
