"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { compressImageFile } from "@/lib/image-compression";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

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
      window.location.reload();
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
      window.location.reload();
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
      <div className="space-y-2 rounded-xl border border-line bg-surface-2/60 p-2 text-left">
        <p className="text-xs font-semibold text-ink">Comprovante enviado</p>
        <a
          href={`/api/payment-proof/${attendanceId}`}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/payment-proof/${attendanceId}`}
            alt="Seu comprovante Pix"
            className="max-h-52 w-full rounded-lg border border-line bg-white object-contain"
          />
        </a>
        <p className="text-center text-[10px] font-medium text-brand">
          Toque na imagem para ampliar.
        </p>
        <p className="text-[11px] text-muted">
          Aguardando análise do administrador. Você pode remover e enviar outro enquanto não
          for analisado.
        </p>
        {note ? (
          <p className="whitespace-pre-line text-[11px] text-ink/80">Comentário: {note}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void remove()}
          disabled={removing}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-60"
        >
          {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {removing ? "Removendo..." : "Remover comprovante"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <textarea
        ref={noteRef}
        name="note"
        rows={2}
        maxLength={500}
        placeholder="Comentário opcional. Ex.: Pix feito pela Maria para mim e para o João."
        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-ink outline-none transition placeholder:text-muted/60 focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/35 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand/15 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "Compactando e enviando..." : "Enviar comprovante Pix"}
      </button>
      <p className="text-center text-[10px] text-muted">
        A imagem é compactada automaticamente e fica privada até a análise do admin.
      </p>
    </div>
  );
}
