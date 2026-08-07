import { OcrResult } from "@/types/pdfAnalysis";
import { runTesseractOcr } from "./tesseractProvider";

export interface OcrOptions {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  pageNumber: number;
}

export async function runOcr(options: OcrOptions): Promise<OcrResult> {
  // In the future, this can switch between Tesseract, Document AI, Azure, etc.
  // For now, we route it directly to Tesseract.
  return await runTesseractOcr(options);
}
