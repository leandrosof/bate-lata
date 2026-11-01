"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, buttonVariants } from "./button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export function SubmitButton({
  label,
  pendingLabel,
  className,
  variant,
  size,
  block,
  icon,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
  icon?: React.ReactNode;
} & VariantProps<typeof buttonVariants>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} block={block} className={className} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {pending ? (pendingLabel ?? "Salvando...") : label}
    </Button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden />;
}
