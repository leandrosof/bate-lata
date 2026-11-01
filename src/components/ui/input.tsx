import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-ink shadow-inner shadow-black/10 outline-none transition placeholder:text-muted/55 hover:border-line-strong focus:border-brand/70 focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60";

export function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      className={cn("mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted", className)}
      {...props}
    >
      {children}
      {required ? <span className="ml-0.5 text-brand">*</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(fieldBase, "h-11 appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-[#ff9a9a]" role="alert">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-muted">{children}</p>;
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: string; description?: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2/60 p-3 transition hover:border-line-strong",
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line accent-[#2f6bff]"
        {...props}
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Switch({
  label,
  description,
  ...props
}: React.ComponentProps<"input"> & { label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface-2/60 p-3.5">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input type="checkbox" className="peer h-6 w-11 cursor-pointer appearance-none rounded-full border border-line bg-surface-3 transition checked:border-brand checked:bg-brand" {...props} />
        <span className="pointer-events-none absolute left-1 h-4 w-4 rounded-full bg-white/80 transition peer-checked:translate-x-5 peer-checked:bg-white" />
      </span>
    </label>
  );
}

export function FormRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2", className)}>{children}</div>;
}
