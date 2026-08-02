import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { OcrPageInput, OcrProvider } from "./types";
import { normalizeDocumentAiResult } from "./normalizeOcrResult";
import { PageAnalysis } from "@/types/pdfAnalysis";

export class GoogleDocumentAiProvider implements OcrProvider {
  private client: DocumentProcessorServiceClient;

  constructor() {
    this.client = new DocumentProcessorServiceClient();
  }

  async analyzePage(input: OcrPageInput): Promise<Partial<PageAnalysis>> {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

    if (!projectId || !location || !processorId) {
      throw new Error("Google Cloud Document AI credentials/settings are not configured.");
    }

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    // Remove data URL prefix if present (e.g. data:image/png;base64,)
    const base64Data = input.imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const request = {
      name,
      rawDocument: {
        content: base64Data,
        mimeType: "image/png",
      },
    };

    const startTime = performance.now();
    const [result] = await this.client.processDocument(request);
    const endTime = performance.now();
    
    if (!result.document) {
      throw new Error("No document returned from Document AI.");
    }

    return normalizeDocumentAiResult(result.document, input.pageNumber, Math.round(endTime - startTime));
  }
}
