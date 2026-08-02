import { PageAnalysis } from "@/types/pdfAnalysis";

export interface OcrPageInput {
  documentId: string;
  pageNumber: number;
  imageBase64: string;
  provider: string;
}

export interface OcrProvider {
  analyzePage(input: OcrPageInput): Promise<Partial<PageAnalysis>>;
}
