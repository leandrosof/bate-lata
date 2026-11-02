import { Grid2X2, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { surfaceLabel } from "@/lib/surface";
import { cn } from "@/lib/utils";

export function SurfaceBadge({
  surface,
  className,
}: {
  surface: string | null | undefined;
  className?: string;
}) {
  const label = surfaceLabel(surface);
  if (!label) return null;

  const Icon = surface === "SAND" ? Waves : Grid2X2;

  return (
    <Badge tone={surface === "SAND" ? "warning" : "brand"} className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
