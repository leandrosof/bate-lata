import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  action,
  actionInline,
  backHref,
  backLabel = "Voltar",
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  actionInline?: boolean;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 animate-[rise_0.35s_ease-out_both]", className)}>
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-brand-soft text-brand">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
            ) : null}
            {actionInline ? (
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-wide text-ink sm:text-4xl">
                  {title}
                </h1>
                {action ? <div className="shrink-0">{action}</div> : null}
              </div>
            ) : (
              <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-wide text-ink sm:text-4xl">
                {title}
              </h1>
            )}
            {subtitle ? <p className="mt-1.5 w-full text-sm text-muted">{subtitle}</p> : null}
          </div>
        </div>
        {action && !actionInline ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
