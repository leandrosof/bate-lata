import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export function EventPriceBadge({
  paymentMode,
  priceCents,
  onDark = false,
  className,
}: {
  paymentMode: "FREE" | "PAID" | null | undefined;
  priceCents: number | null | undefined;
  onDark?: boolean;
  className?: string;
}) {
  if (paymentMode === "PAID") {
    if (!priceCents || priceCents <= 0) {
      return (
        <Badge
          tone="danger"
          className={cn(
            "shrink-0 normal-case font-bold",
            onDark && "border-red-300/50 bg-red-600 text-white shadow-md",
            className,
          )}
        >
          Valor pendente
        </Badge>
      );
    }

    return (
      <Badge
        tone="brand"
        className={cn(
          "shrink-0 normal-case font-bold",
          onDark
            ? "border-white/60 bg-white px-2.5 py-1 text-[11px] text-slate-900 shadow-md ring-1 ring-black/10"
            : "font-semibold",
          className,
        )}
      >
        {formatCents(priceCents)}
      </Badge>
    );
  }

  return (
    <Badge
      tone="success"
      className={cn(
        "shrink-0 normal-case font-bold",
        onDark && "border-emerald-300/50 bg-emerald-500 text-white shadow-md",
        className,
      )}
    >
      Gratuito
    </Badge>
  );
}
