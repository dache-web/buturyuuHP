import { OcrPageInput, OcrProvider } from "./types";
import { GoogleDocumentAiProvider } from "./googleDocumentAiProvider";

export async function getOcrProvider(providerName: string): Promise<OcrProvider> {
  if (providerName === "google_document_ai") {
    return new GoogleDocumentAiProvider();
  }
  throw new Error(`Unknown OCR provider: ${providerName}`);
}

export async function analyzePageWithOcr(input: OcrPageInput) {
  const provider = await getOcrProvider(input.provider);
  return provider.analyzePage(input);
}
