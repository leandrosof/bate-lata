"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { compressImageFile } from "@/lib/image-compression";
import { useToast } from "@/components/ui/toast-provider";

export function PaymentProofUpload({ attendanceId }: { attendanceId: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);

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
