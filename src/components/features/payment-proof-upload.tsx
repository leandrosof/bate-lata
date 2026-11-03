"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { FileImage, Loader2, Trash2, Upload, X } from "lucide-react";
import { compressImageFile } from "@/lib/image-compression";
import { PaymentProofPreview } from "@/components/features/payment-proof-preview";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

export function PaymentProofUpload({
  attendanceId,
  hasProof = false,
  note = null,
}: {
  attendanceId: string;
  hasProof?: boolean;
  note?: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    const timer = window.setTimeout(() => noteRef.current?.focus(), 20);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  async function upload(file: File) {
    setBusy(true);

    try {
      const optimized = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1600,
        targetBytes: 220 * 1024,
        quality: 0.7,
      });

      const body = new FormData();
      body.append("proof", optimized);
      body.append("note", noteRef.current?.value ?? "");

      const response = await fetch(`/api/payment-proof/${attendanceId}`, {
        method: "POST",
        body,
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        toast({
          tone: "error",
          message: data?.error ?? "Não foi possível enviar o comprovante.",
        });
        return;
      }

      toast({
        tone: "success",
        message: "Comprovante enviado. Aguardando aprovação do administrador.",
      });
      setSelectedFile(null);
      setOpen(false);
      router.refresh();
    } catch {
      toast({
        tone: "error",
        message:
          "Não foi possível processar a imagem. Tente outra foto ou um print da tela.",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!window.confirm("Remover o comprovante enviado? Você poderá enviar outro.")) {
      return;
    }

    setRemoving(true);

    try {
      const response = await fetch(`/api/payment-proof/${attendanceId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        toast({
          tone: "error",
          message: data?.error ?? "Não foi possível remover o comprovante.",
        });
        return;
      }

      toast({ tone: "success", message: "Comprovante removido." });
      router.refresh();
    } catch {
      toast({
        tone: "error",
        message: "Não foi possível remover o comprovante. Tente novamente.",
      });
    } finally {
      setRemoving(false);
    }
  }

  if (hasProof) {
    return (
      <div className="rounded-xl border border-line bg-surface-2/50 p-2.5 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <FileImage className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">
              Comprovante enviado <span className="font-normal text-warning">· Em análise</span>
            </p>
            <p className="truncate text-[11px] text-muted" title={note ?? undefined}>
              {note ? `Comentário: ${note}` : "Aguardando análise do administrador"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <PaymentProofPreview
              attendanceId={attendanceId}
              title="Seu comprovante Pix"
              showThumbnail={false}
              triggerLabel="Visualizar comprovante"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void remove()}
              disabled={removing}
              aria-label="Remover comprovante"
              className="text-danger hover:bg-danger/10 hover:text-danger"
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {removing ? "Removendo..." : "Remover"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" block onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Enviar comprovante Pix
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4"
              role="presentation"
              onMouseDown={(event) => {
                if (!busy && event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                aria-hidden
                onClick={() => {
                  if (!busy) setOpen(false);
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-start justify-between gap-3 border-b border-line/70 p-4">
                  <div className="min-w-0">
                    <h2
                      id={titleId}
                      className="font-display text-lg font-semibold uppercase tracking-wide text-ink"
                    >
                      Enviar comprovante Pix
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Escreva o comentário antes de enviar. Depois do envio, não será possível
                      adicionar ou editar o comentário.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                    aria-label="Fechar"
                    className="rounded-lg p-1 text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-50"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <div className="space-y-3 p-4">
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setSelectedFile(file ?? null);
                    }}
                  />
                  <textarea
                    ref={noteRef}
                    name="note"
                    rows={3}
                    maxLength={500}
                    placeholder="Comentário opcional. Ex.: Pix feito pela Maria para mim e para o João."
                    className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-ink outline-none transition placeholder:text-muted/60 focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
                  />
                  <Button
                    variant="secondary"
                    block
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                  >
                    <FileImage className="h-4 w-4" />
                    {selectedFile ? "Trocar imagem" : "Selecionar imagem do comprovante"}
                  </Button>
                  {selectedFile ? (
                    <p className="truncate text-center text-[10px] text-muted">
                      Selecionado: {selectedFile.name}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-line/70 bg-surface-2/30 p-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (selectedFile) void upload(selectedFile);
                    }}
                    disabled={busy || !selectedFile}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {busy ? "Enviando..." : "Enviar comprovante"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
