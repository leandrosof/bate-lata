import Link from "next/link";
import { cn } from "@/lib/utils";

export function LinkTabs({
  items,
  className,
}: {
  items: { href: string; label: string; active?: boolean; count?: number }[];
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-surface/80 p-1.5",
        className,
      )}
      aria-label="Filtros"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition",
            item.active
              ? "bg-brand text-white shadow-[0_8px_20px_-12px_rgba(47,107,255,1)]"
              : "text-muted hover:bg-white/5 hover:text-ink",
          )}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                item.active ? "bg-white/20 text-white" : "bg-white/8 text-muted",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
