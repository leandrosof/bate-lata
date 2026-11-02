"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, X } from "lucide-react";
import { closeCourtAction } from "@/actions/racha";
import type { ActionState } from "@/lib/action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast-provider";

type CourtOption = {
  number: number;
  inUse: boolean;
};

export function CloseCourtDialog({
  drawId,
  courts,
  defaultCourt,
}: {
  drawId: string;
  courts: CourtOption[];
  defaultCourt?: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    useCallback(async (previous: ActionState, formData: FormData) => {
      const result = await closeCourtAction(previous, formData);
      if (result?.ok) setOpen(false);
      return result;
    }, []),
    null,
  );
  const { toast } = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const selectId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 20);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!state?.message) return;
    toast({ message: state.message, tone: state.ok ? "success" : "error" });
  }, [state, toast]);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={courts.length === 0}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
        Fechar quadra
      </Button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                aria-hidden
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-start gap-3 p-4 pb-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
                    <Minus className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h2
                      id={titleId}
                      className="font-display text-lg font-semibold uppercase tracking-wide text-ink"
                    >
                      Fechar quadra
                    </h2>
                    <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted">
                      Escolha qual quadra deseja encerrar. Se houver partida, ela será cancelada e os
                      jogadores voltam para a fila.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                    className="rounded-lg p-1 text-muted transition hover:bg-ink/5 hover:text-ink"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <form action={formAction} className="border-t border-line/70 bg-surface-2/30 p-3">
                  <input type="hidden" name="drawId" value={drawId} />
                  <div>
                    <Label htmlFor={selectId} required>
                      Quadra
                    </Label>
                    <Select
                      id={selectId}
                      name="court"
                      defaultValue={String(defaultCourt ?? courts[0]?.number ?? "")}
                      required
                    >
                      {courts.map((court) => (
                        <option key={court.number} value={court.number}>
                          Quadra {court.number} · {court.inUse ? "com partida" : "vazia"}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {state && !state.ok && state.message ? (
                    <Alert tone="danger" className="mt-3">
                      {state.message}
                    </Alert>
                  ) : null}

                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      ref={cancelRef}
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={() => setOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <SubmitButton
                      label="Fechar quadra"
                      pendingLabel="Fechando..."
                      variant="danger"
                      size="md"
                    />
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
