import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import type { OcrInput, OcrProvider, OcrResult } from "./types";

export class TesseractOcrProvider implements OcrProvider {
  readonly name = "tesseract";

  async recognize(input: OcrInput): Promise<OcrResult> {
    const image = await sharp(input.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();

    const cachePath =
      process.env.TESSERACT_CACHE_PATH?.trim() ||
      path.join(os.tmpdir(), "bate-lata-tesseract");
    await mkdir(cachePath, { recursive: true });

    const worker = await createWorker("por", 1, {
      cachePath,
      ...(process.env.TESSERACT_LANG_PATH
        ? { langPath: process.env.TESSERACT_LANG_PATH }
        : {}),
    });

    try {
      const result = await worker.recognize(image);

      return {
        text: result.data.text,
        confidence: Math.round(result.data.confidence),
        provider: this.name,
      };
    } finally {
      await worker.terminate();
    }
  }
}
