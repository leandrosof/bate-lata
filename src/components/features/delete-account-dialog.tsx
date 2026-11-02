"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteAccountAction } from "@/actions/profile";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteAccountAction, null);
  const titleId = useId();
  const descriptionId = useId();
  const passwordId = useId();
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

  return (
    <>
      <Button type="button" variant="danger" size="md" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden />
        Excluir minha conta
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
                className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[rgba(240,82,82,0.3)] bg-surface shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-start gap-3 p-4 pb-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
                    <AlertTriangle className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h2
                      id={titleId}
                      className="font-display text-lg font-semibold uppercase tracking-wide text-ink"
                    >
                      Excluir minha conta
                    </h2>
                    <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted">
                      Seus dados de acesso, nome, e-mail, apelido e fotos serão removidos, e sua conta
                      será desativada. O histórico de partidas do grupo é preservado de forma anônima.
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
                  <div>
                    <Label htmlFor={passwordId} required>
                      Confirme sua senha
                    </Label>
                    <Input
                      id={passwordId}
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Digite sua senha atual"
                      required
                    />
                  </div>

                  {state && !state.ok && state.message ? (
                    <Alert tone="danger" className="mt-3">
                      {state.message}
                    </Alert>
                  ) : null}

                  <p className="mt-3 text-[11px] font-medium text-danger">
                    Esta ação não pode ser desfeita.
                  </p>

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
                      label="Excluir minha conta"
                      pendingLabel="Excluindo..."
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
