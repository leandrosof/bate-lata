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
    <Link href={href} className={cn("group flex min-w-0 items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#1d4ed8] via-[#2f6bff] to-[#38bdf8] shadow-[0_10px_24px_-10px_rgba(47,107,255,0.9)] transition group-hover:scale-[1.03]",
          compact ? "h-9 w-9" : "h-10 w-10",
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Volleyball className={cn("text-white", compact ? "h-5 w-5" : "h-[22px] w-[22px]")} aria-hidden />
        )}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-display font-bold uppercase leading-none tracking-wide text-ink",
            compact ? "text-base" : "text-lg",
          )}
        >
          {siteName}
        </span>
        {tagline ? (
          <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
            {tagline}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
