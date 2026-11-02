"use client";

export type CompressImageOptions = {
  maxWidth: number;
  maxHeight: number;
  targetBytes: number;
  quality?: number;
};

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível otimizar a imagem."));
      },
      "image/webp",
      quality,
    );
  });
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

export async function compressImageFile(
  file: File,
  options: CompressImageOptions,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await decodeImage(file);
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const maxScale = Math.min(
    1,
    options.maxWidth / Math.max(1, sourceWidth),
    options.maxHeight / Math.max(1, sourceHeight),
  );

  let width = Math.max(1, Math.round(sourceWidth * maxScale));
  let height = Math.max(1, Math.round(sourceHeight * maxScale));
  let quality = options.quality ?? 0.86;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Não foi possível processar a imagem.");
  }

  let output: Blob | null = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    let attemptQuality = quality;
    while (attemptQuality >= 0.5) {
      const blob = await canvasToBlob(canvas, attemptQuality);
      if (!output || blob.size < output.size) output = blob;
      if (blob.size <= options.targetBytes) {
        output = blob;
        break;
      }
      attemptQuality -= 0.08;
    }

    if (output && output.size <= options.targetBytes) break;
    if (width <= 480 && height <= 480) break;

    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
    quality = Math.max(0.5, quality - 0.04);
  }

  bitmap.close();

  if (!output) throw new Error("Não foi possível otimizar a imagem.");

  const extension =
    output.type === "image/webp" ? "webp" : output.type === "image/jpeg" ? "jpg" : "png";
  const name = file.name.replace(/\.[^.]+$/, "") || "imagem";

  return new File([output], `${name}.${extension}`, {
    type: output.type || "image/webp",
    lastModified: Date.now(),
  });
}
