import { cn } from "@/lib/utils";

const sizes = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
} as const;

export function Avatar({
  userId,
  name,
  size = "md",
  version,
  className,
}: {
  userId: string;
  name: string;
  size?: keyof typeof sizes;
  version?: Date | null;
  className?: string;
}) {
  const query = version ? `?v=${version.getTime()}` : "";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full border border-line bg-surface-3",
        sizes[size],
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/avatar/${userId}${query}`}
        alt={`Foto de ${name}`}
        className="h-full w-full object-cover"
        loading="lazy"
        width={96}
        height={96}
      />
    </span>
  );
}
