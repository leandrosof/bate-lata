import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: {
    wrap: "border-[rgba(47,107,255,0.32)] bg-[rgba(47,107,255,0.1)] text-brand-strong",
    icon: Info,
  },
  success: {
    wrap: "border-[rgba(34,197,94,0.32)] bg-[rgba(34,197,94,0.09)] text-success",
    icon: CircleCheck,
  },
  warning: {
    wrap: "border-[rgba(245,185,66,0.32)] bg-[rgba(245,185,66,0.09)] text-warning",
    icon: CircleAlert,
  },
  danger: {
    wrap: "border-[rgba(240,82,82,0.32)] bg-[rgba(240,82,82,0.09)] text-danger",
    icon: CircleX,
  },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const config = tones[tone];
  const Icon = config.icon;
  return (
    <div
      className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm", config.wrap, className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("break-words", title && "mt-0.5 opacity-90")}>{children}</div> : null}
      </div>
    </div>
  );
}
