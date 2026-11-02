import { cn } from "@/lib/utils";

const badgeVariants = {
  neutral: "border-line bg-ink/[0.04] text-muted",
  brand: "border-brand/30 bg-brand/10 text-brand font-medium",
  success: "border-success/30 bg-success-soft text-success font-medium",
  warning: "border-warning/30 bg-warning-soft text-warning font-medium",
  danger: "border-danger/30 bg-danger-soft text-danger font-medium",
  live: "border-danger/30 bg-danger-soft text-danger font-semibold",
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
