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
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 shadow-md ring-2 ring-brand/20 transition duration-300 group-hover:scale-105 group-hover:ring-brand/40",
          compact ? "h-12 w-12" : "h-12 w-12 sm:h-14 sm:w-14",
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={siteName} className="h-full w-full object-cover" />
        ) : (
          <Volleyball className={cn("text-brand", compact ? "h-6 w-6" : "h-7 w-7")} aria-hidden />
        )}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-display font-extrabold leading-none tracking-tight text-ink transition-colors group-hover:text-ink",
            compact ? "text-lg sm:text-xl" : "text-xl",
          )}
        >
          {siteName}
        </span>
        {tagline ? (
          <span className="mt-1 block whitespace-normal text-[10px] font-bold uppercase leading-tight tracking-wider text-brand sm:text-[11px]">
            {tagline}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
