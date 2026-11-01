export type AvatarCropGeometry = {
  left: number;
  top: number;
  size: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getAvatarCropGeometry(
  width: number,
  height: number,
  x: number,
  y: number,
  zoom: number,
): AvatarCropGeometry {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Imagem inválida.");
  }

  const safeX = clamp(Number.isFinite(x) ? x : 0.5, 0, 1);
  const safeY = clamp(Number.isFinite(y) ? y : 0.5, 0, 1);
  const safeZoom = clamp(Number.isFinite(zoom) ? zoom : 1, 1, 3);
  const size = Math.min(width, height) / safeZoom;
  const maxLeft = Math.max(0, width - size);
  const maxTop = Math.max(0, height - size);

  return {
    left: clamp(safeX * width - size / 2, 0, maxLeft),
    top: clamp(safeY * height - size / 2, 0, maxTop),
    size,
  };
}
