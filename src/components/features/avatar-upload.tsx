"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Move, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AvatarCropDialog } from "@/components/features/avatar-crop-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";

export function AvatarUpload({
  userId,
  name,
  version,
  hasOriginal,
}: {
  userId: string;
  name: string;
  version: Date | null;
  hasOriginal?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast({ tone: "error", message: "A imagem deve ter no máximo 2 MB." });
      return;
    }

    setBusy("upload");
    try {
      const body = new FormData();
      body.append("avatar", file);
      const response = await fetch("/api/perfil/avatar", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast({ tone: "error", message: data?.error ?? "Não foi possível enviar a imagem." });
        return;
      }
      toast({ tone: "success", message: "Foto atualizada." });
      router.refresh();
    } catch {
      toast({ tone: "error", message: "Falha de conexão. Tente novamente." });
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      const response = await fetch("/api/perfil/avatar", { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast({ tone: "error", message: data?.error ?? "Não foi possível remover a foto." });
        return;
      }
      toast({ tone: "success", message: "Foto removida." });
      router.refresh();
    } catch {
      toast({ tone: "error", message: "Falha de conexão. Tente novamente." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Avatar userId={userId} name={name} version={version} size="lg" />
        <div className="flex flex-wrap gap-2">
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
          >
            {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {busy === "upload" ? "Enviando..." : "Trocar foto"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCropOpen(true)}
            disabled={busy !== null || !hasOriginal}
            title={hasOriginal ? "Reposicionar foto" : "Reenvie a foto para reposicionar"}
          >
            <Move className="h-4 w-4" />
            Reposicionar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)} disabled={busy !== null}>
            {busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted">JPG, PNG, WebP ou AVIF · até 2 MB. A imagem é recortada em 256×256.</p>
      <AvatarCropDialog
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        onSaved={() => {
          toast({ tone: "success", message: "Foto reposicionada." });
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirmRemove}
        title="Remover foto"
        message="Deseja remover sua foto de perfil?"
        confirmLabel="Remover"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          void remove();
        }}
      />
    </div>
  );
}
