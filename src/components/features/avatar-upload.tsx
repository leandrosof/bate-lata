"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function AvatarUpload({
  userId,
  name,
  version,
}: {
  userId: string;
  name: string;
  version: Date | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function upload(file: File) {
    setError(null);
    setSuccess(null);

    if (file.size > 2 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 2 MB.");
      return;
    }

    setBusy("upload");
    try {
      const body = new FormData();
      body.append("avatar", file);
      const response = await fetch("/api/perfil/avatar", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "Não foi possível enviar a imagem.");
        return;
      }
      setSuccess("Foto atualizada.");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setError(null);
    setSuccess(null);
    setBusy("remove");
    try {
      const response = await fetch("/api/perfil/avatar", { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Não foi possível remover a foto.");
        return;
      }
      setSuccess("Foto removida.");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
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
          <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)} disabled={busy !== null}>
            {busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted">JPG, PNG, WebP ou AVIF · até 2 MB. A imagem é recortada em 256×256.</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
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
