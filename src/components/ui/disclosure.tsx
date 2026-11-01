import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Disclosure({
  title,
  subtitle,
  children,
  defaultOpen,
  className,
  action,
  tone = "default",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  action?: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <details
      className={cn(
        "group rounded-xl border bg-surface-2/40 transition open:bg-surface-2/70",
        tone === "danger" ? "border-[rgba(240,82,82,0.25)]" : "border-line",
        className,
      )}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs text-muted">{subtitle}</span> : null}
        </span>
        {action}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line px-3.5 py-4">{children}</div>
    </details>
  );
}
