"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { compressImageFile } from "@/lib/image-compression";
import { useToast } from "@/components/ui/toast-provider";

export function PaymentProofUpload({ attendanceId }: { attendanceId: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);

    try {
      const optimized = await compressImageFile(file, {
        maxWidth: 1400,
        maxHeight: 1400,
        targetBytes: 1.5 * 1024 * 1024,
      });

      if (optimized.size > 4 * 1024 * 1024) {
        toast({
          tone: "error",
          message: "Imagem muito grande. Envie um print ou uma foto menor.",
        });
        return;
      }

      const body = new FormData();
      body.append("proof", optimized);

      const response = await fetch(`/api/payment-proof/${attendanceId}`, {
        method: "POST",
        body,
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; autoApproved?: boolean }
        | null;

      if (!response.ok) {
        toast({
          tone: "error",
          message: data?.error ?? "Não foi possível enviar o comprovante.",
        });
        return;
      }

      toast({
        tone: "success",
        message: data?.autoApproved
          ? "Comprovante aprovado automaticamente. Presença confirmada!"
          : "Comprovante recebido. Aguardando análise do administrador.",
      });
      window.location.reload();
    } catch {
      toast({
        tone: "error",
        message:
          "Falha ao processar a imagem. Use JPG, PNG ou WebP, ou envie um print da tela.",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/35 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand/15 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "Lendo comprovante..." : "Enviar comprovante Pix"}
      </button>
      <p className="text-center text-[10px] text-muted">
        O arquivo é processado na hora e não fica salvo no banco.
      </p>
    </div>
  );
}
