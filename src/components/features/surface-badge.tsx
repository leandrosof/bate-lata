import { Grid2X2, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { surfaceLabel } from "@/lib/surface";
import { cn } from "@/lib/utils";

export function SurfaceBadge({
  surface,
  className,
  onDark,
}: {
  surface: string | null | undefined;
  className?: string;
  onDark?: boolean;
}) {
  const label = surfaceLabel(surface);
  if (!label) return null;

  const Icon = surface === "SAND" ? Waves : Grid2X2;
  const darkClasses =
    surface === "SAND"
      ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
      : "border-sky-300/40 bg-sky-400/15 text-sky-100";

  return (
    <Badge
      tone={surface === "SAND" ? "warning" : "brand"}
      className={cn("gap-1", onDark && darkClasses, className)}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
