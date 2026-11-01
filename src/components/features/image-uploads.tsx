"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function useUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return { router, busy, setBusy, error, setError, confirmRemove, setConfirmRemove };
}

export function LogoUpload({
  hasLogo,
  version,
}: {
  hasLogo: boolean;
  version?: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { router, busy, setBusy, error, setError, confirmRemove, setConfirmRemove } = useUploader();

  async function upload(file: File) {
    setError(null);
    setBusy("upload");
    try {
      const body = new FormData();
      body.append("logo", file);
      const response = await fetch("/api/logo", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "Não foi possível enviar a logo.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await fetch("/api/logo", { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2">
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/logo?v=${version ?? 0}`} alt="Logo do grupo" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted" aria-hidden />
          )}
        </span>
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
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
          >
            {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {hasLogo ? "Trocar logo" : "Enviar logo"}
          </Button>
          {hasLogo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(true)}
              disabled={busy !== null}
            >
              {busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remover
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-[11px] text-muted">PNG/JPG/WebP, até 2 MB. Recomendado quadrado (512×512).</p>
      {error ? <p className="text-xs text-[#ff9a9a]">{error}</p> : null}
      <ConfirmDialog
        open={confirmRemove}
        title="Remover logo"
        message="Deseja remover a logo do grupo?"
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

export function EventCoverUpload({
  eventId,
  hasCover,
  version,
}: {
  eventId: string;
  hasCover: boolean;
  version?: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { router, busy, setBusy, error, setError, confirmRemove, setConfirmRemove } = useUploader();

  async function upload(file: File) {
    setError(null);
    setBusy("upload");
    try {
      const body = new FormData();
      body.append("cover", file);
      const response = await fetch(`/api/event-cover/${eventId}`, { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "Não foi possível enviar a capa.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await fetch(`/api/event-cover/${eventId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {hasCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/event-cover/${eventId}?v=${version ?? 0}`}
            alt="Capa do evento"
            className="h-20 w-36 rounded-xl border border-line object-cover"
          />
        ) : (
          <span className="flex h-20 w-36 items-center justify-center rounded-xl border border-dashed border-line text-xs text-muted">
            Sem capa
          </span>
        )}
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
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
        >
          {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {hasCover ? "Trocar capa" : "Enviar capa"}
        </Button>
        {hasCover ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmRemove(true)}
            disabled={busy !== null}
          >
            {busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted">Opcional. Formato paisagem; recomendado 1200×675.</p>
      {error ? <p className="text-xs text-[#ff9a9a]">{error}</p> : null}
      <ConfirmDialog
        open={confirmRemove}
        title="Remover capa"
        message="Deseja remover a capa deste evento?"
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
