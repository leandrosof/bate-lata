"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Move, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAvatarCropGeometry } from "@/lib/avatar-crop";

const PREVIEW_SIZE = 224;

export function AvatarCropDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    void fetch("/api/perfil/avatar", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sem imagem original.");
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setNatural(null);
          setSrc(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Reenvie a foto para poder reposicionar.");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const geometry = natural
    ? getAvatarCropGeometry(natural.width, natural.height, x / 100, y / 100, zoom)
    : null;
  const scale = geometry ? PREVIEW_SIZE / geometry.size : 1;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/perfil/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: x / 100, y: y / 100, zoom }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "Não foi possível reposicionar.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reposicionar foto"
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-line-strong bg-[#0b1220] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line/70 p-3">
          <div className="flex items-center gap-2">
            <Move className="h-4 w-4 text-[#9db8ff]" aria-hidden />
            <p className="font-display text-base font-semibold uppercase tracking-wide text-white">
              Reposicionar foto
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-muted hover:text-ink">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div
            className="relative mx-auto overflow-hidden rounded-full border border-line bg-surface-3"
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt="Prévia do avatar"
                onLoad={(event) =>
                  setNatural({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                }
                className="absolute max-w-none"
                style={
                  natural && geometry
                    ? {
                        width: natural.width * scale,
                        height: natural.height * scale,
                        left: -geometry.left * scale,
                        top: -geometry.top * scale,
                      }
                    : { width: PREVIEW_SIZE, height: PREVIEW_SIZE, objectFit: "cover" }
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
              </div>
            )}
          </div>

          <label className="block space-y-1 text-xs text-muted">
            <span>Horizontal</span>
            <input
              type="range"
              min={0}
              max={100}
              value={x}
              onChange={(event) => setX(Number(event.target.value))}
              className="w-full accent-[#2f6bff]"
            />
          </label>
          <label className="block space-y-1 text-xs text-muted">
            <span>Vertical</span>
            <input
              type="range"
              min={0}
              max={100}
              value={y}
              onChange={(event) => setY(Number(event.target.value))}
              className="w-full accent-[#2f6bff]"
            />
          </label>
          <label className="block space-y-1 text-xs text-muted">
            <span className="flex items-center gap-1">
              <ZoomIn className="h-3.5 w-3.5" aria-hidden /> Zoom
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-[#2f6bff]"
            />
          </label>

          {error ? <p className="text-xs font-medium text-[#ff9a9a]">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line/70 bg-surface-2/30 p-3">
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" size="md" onClick={() => void save()} disabled={busy || !src}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Salvar posição
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
