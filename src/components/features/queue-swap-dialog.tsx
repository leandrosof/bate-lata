"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Loader2, X } from "lucide-react";
import { swapQueuePlayersAction } from "@/actions/racha";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";

type QueuePlayerOption = {
  attendanceId: string;
  name: string;
  position: number;
};

export function QueueSwapDialog({
  attendanceId,
  playerName,
  players,
}: {
  attendanceId: string;
  playerName: string;
  players: QueuePlayerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const { toast } = useToast();
  const [, formAction, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await swapQueuePlayersAction(previous, formData);
      if (result?.ok) {
        setOpen(false);
        toast({ tone: "success", message: result.message ?? "Jogadores trocados." });
      } else {
        toast({ tone: "error", message: result?.message ?? "Não foi possível trocar os jogadores." });
      }
      return result;
    },
    null,
  );
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const others = players.filter((player) => player.attendanceId !== attendanceId);

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

  if (others.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title="Trocar de posição"
        onClick={() => {
          setSelected("");
          setOpen(true);
        }}
      >
        <ArrowLeftRight className="h-4 w-4" aria-hidden />
        Trocar
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line-strong bg-surface p-4 shadow-xl"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand">
                      Fila de espera
                    </p>
                    <h2 id={titleId} className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
                      Trocar {playerName}
                    </h2>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                    className="rounded-lg p-1 text-muted hover:text-ink"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <p className="mt-2 text-sm text-muted">
                  Escolha com quem trocar de posição. Os dois mudam de lugar na fila.
                </p>

                <form action={formAction} className="mt-3 space-y-3">
                  <input type="hidden" name="attendanceId" value={attendanceId} />
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {others.map((player) => (
                      <label
                        key={player.attendanceId}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                          selected === player.attendanceId
                            ? "border-brand/60 bg-brand-soft/40"
                            : "border-line/70 hover:border-line-strong",
                        )}
                      >
                        <input
                          type="radio"
                          name="targetAttendanceId"
                          value={player.attendanceId}
                          checked={selected === player.attendanceId}
                          onChange={() => setSelected(player.attendanceId)}
                          className="h-4 w-4 shrink-0 accent-[#2f6bff]"
                          required
                        />
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink/5 text-[10px] font-bold text-muted">
                          #{player.position}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                          {player.name}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="primary" size="sm" disabled={!selected || pending}>
                      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      {pending ? "Trocando..." : "Trocar de lugar"}
                    </Button>
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
