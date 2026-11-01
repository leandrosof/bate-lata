"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, ShieldAlert, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export type ConfirmTone = "danger" | "warning" | "primary";

const toneStyles: Record<
  ConfirmTone,
  { icon: typeof AlertTriangle; iconClass: string; ringClass: string; button: "danger" | "primary" | "secondary" }
> = {
  danger: {
    icon: ShieldAlert,
    iconClass: "bg-[rgba(240,82,82,0.14)] text-[#ff9a9a]",
    ringClass: "border-[rgba(240,82,82,0.25)]",
    button: "danger",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "bg-[rgba(245,185,66,0.14)] text-[#fbd38d]",
    ringClass: "border-[rgba(245,185,66,0.25)]",
    button: "secondary",
  },
  primary: {
    icon: Info,
    iconClass: "bg-brand-soft text-[#9db8ff]",
    ringClass: "border-[rgba(47,107,255,0.28)]",
    button: "primary",
  },
};

export function ConfirmDialog({
  open,
  title = "Confirmar ação",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const style = toneStyles[tone];
  const Icon = style.icon;

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancelRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 20);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-hidden
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-2xl border bg-[#0b1220] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]",
          style.ringClass,
        )}
      >
        <div className="flex items-start gap-3 p-4 pb-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.iconClass)}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="font-display text-lg font-semibold uppercase tracking-wide text-white">
              {title}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            className="rounded-lg p-1 text-muted transition hover:bg-white/5 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line/70 bg-surface-2/30 p-3 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} type="button" variant="ghost" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={style.button} size="md" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
