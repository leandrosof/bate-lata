export type OcrInput = {
  buffer: Buffer;
  mimeType: string;
};

export type OcrResult = {
  text: string;
  confidence: number;
  provider: string;
};

export interface OcrProvider {
  readonly name: string;
  recognize(input: OcrInput): Promise<OcrResult>;
}
