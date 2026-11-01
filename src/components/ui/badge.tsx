import { cn } from "@/lib/utils";

const badgeVariants = {
  neutral: "border-white/10 bg-white/[0.04] text-muted",
  brand: "border-brand/30 bg-brand/10 text-brand font-medium",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium",
  danger: "border-rose-500/30 bg-rose-500/10 text-rose-400 font-medium",
  live: "border-rose-500/30 bg-rose-500/15 text-rose-400 font-semibold shadow-[0_0_12px_rgba(244,63,94,0.2)]",
} as const;

export type BadgeTone = keyof typeof badgeVariants;

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        badgeVariants[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f05252] opacity-70" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#f05252]" />
    </span>
  );
}
