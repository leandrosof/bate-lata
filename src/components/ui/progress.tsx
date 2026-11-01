import { cn } from "@/lib/utils";

export function Progress({
  value,
  max = 100,
  className,
  tone = "brand",
}: {
  value: number;
  max?: number;
  className?: string;
  tone?: "brand" | "success" | "warning" | "danger";
}) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const tones = {
    brand: "bg-gradient-to-r from-[#1d4ed8] via-[#2f6bff] to-[#38bdf8]",
    success: "bg-gradient-to-r from-[#15803d] to-[#22c55e]",
    warning: "bg-gradient-to-r from-[#b45309] to-[#f5b942]",
    danger: "bg-gradient-to-r from-[#b91c1c] to-[#f05252]",
  } as const;

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-white/8", className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", tones[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
