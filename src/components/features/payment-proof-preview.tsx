"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PaymentProofPreview({
  attendanceId,
  title,
  meta,
  imageClassName,
  showThumbnail = true,
  triggerLabel = "Ver em tela maior",
}: {
  attendanceId: string;
  title: string;
  meta?: string;
  imageClassName?: string;
  showThumbnail?: boolean;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    const timer = window.setTimeout(() => closeRef.current?.focus(), 20);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  return (
    <>
      {showThumbnail ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Ampliar ${title}`}
            className="group relative block w-full cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/payment-proof/${attendanceId}`}
              alt={title}
              className={cn(
                "w-full rounded-md border border-line bg-white object-contain",
                imageClassName,
              )}
            />
            <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-white opacity-80 transition group-hover:opacity-100">
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            </span>
          </button>
          <div
            className={cn(
              "mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted",
              meta ? "justify-between" : "justify-end",
            )}
          >
            {meta ? <span>{meta}</span> : null}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-semibold text-brand hover:underline"
            >
              {triggerLabel}
            </button>
          </div>
        </>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Eye className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      )}

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                aria-hidden
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-2rem)]"
              >
                <div className="flex items-center justify-between gap-3 border-b border-line/70 p-3">
                  <h2
                    id={titleId}
                    className="min-w-0 truncate font-display text-sm font-semibold uppercase tracking-wide text-ink"
                  >
                    {title}
                  </h2>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                    className="rounded-lg p-1.5 text-muted transition hover:bg-ink/5 hover:text-ink"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto bg-black/85 p-2 sm:p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/payment-proof/${attendanceId}`}
                    alt={title}
                    className="mx-auto max-h-[78dvh] max-w-full object-contain"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
