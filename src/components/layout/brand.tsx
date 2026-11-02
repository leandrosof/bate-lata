import Link from "next/link";
import { Volleyball } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({
  siteName,
  tagline,
  logoUrl,
  href = "/inicio",
  compact,
  className,
}: {
  siteName: string;
  tagline?: string | null;
  logoUrl?: string | null;
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("group flex min-w-0 items-center gap-3", className)}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-ink/[0.08] to-transparent p-1 ring-1 ring-line-strong shadow-[0_6px_16px_-10px_rgba(0,0,0,0.2)] transition duration-300 group-hover:scale-105 group-hover:ring-brand/40",
          compact ? "h-11 w-11" : "h-12 w-12",
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={siteName} className="h-full w-full object-contain filter drop-shadow" />
        ) : (
          <Volleyball className={cn("text-brand", compact ? "h-6 w-6" : "h-7 w-7")} aria-hidden />
        )}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-display font-black tracking-wider text-ink transition-colors group-hover:text-ink",
            compact ? "text-base tracking-wide" : "text-lg",
          )}
        >
          {siteName}
        </span>
        {tagline ? (
          <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.22em] text-brand">
            {tagline}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
