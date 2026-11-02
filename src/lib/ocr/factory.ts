import type { OcrProvider } from "./types";
import { TesseractOcrProvider } from "./tesseract-provider";

export function createOcrProvider(): OcrProvider {
  const provider = process.env.OCR_PROVIDER ?? "tesseract";

  switch (provider) {
    case "tesseract":
      return new TesseractOcrProvider();

    default:
      throw new Error(`Provedor OCR desconhecido: ${provider}`);
  }
}
