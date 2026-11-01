import { cn } from "@/lib/utils";

const badgeVariants = {
  neutral: "border-line bg-surface-2 text-muted",
  brand: "border-[rgba(47,107,255,0.35)] bg-[rgba(47,107,255,0.14)] text-[#9db8ff]",
  success: "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] text-[#86efac]",
  warning: "border-[rgba(245,185,66,0.35)] bg-[rgba(245,185,66,0.12)] text-[#fbd38d]",
  danger: "border-[rgba(240,82,82,0.35)] bg-[rgba(240,82,82,0.12)] text-[#ff9a9a]",
  live: "border-[rgba(240,82,82,0.45)] bg-[rgba(240,82,82,0.16)] text-[#ffb4b4]",
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
