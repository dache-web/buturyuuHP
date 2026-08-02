import { NextRequest, NextResponse } from "next/server";
import { analyzePageWithOcr } from "@/lib/ocr/ocrProvider";
import { OcrPageInput } from "@/lib/ocr/types";

// Configure body size limit to allow base64 encoded high-res images
export const maxDuration = 60; // 60 seconds timeout for Vercel/Next.js

export async function POST(req: NextRequest) {
  try {
    const body: Partial<OcrPageInput> = await req.json();

    const { documentId, pageNumber, imageBase64, provider } = body;

    if (!pageNumber || !imageBase64) {
      return NextResponse.json(
        { error: "Missing required fields (pageNumber, imageBase64)" },
        { status: 400 }
      );
    }

    const input: OcrPageInput = {
      documentId: documentId || "unknown",
      pageNumber,
      imageBase64,
      provider: provider || "google_document_ai",
    };

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
    const missingSettings = [];
    if (!projectId) missingSettings.push("GOOGLE_CLOUD_PROJECT_ID");
    if (!location) missingSettings.push("GOOGLE_CLOUD_LOCATION");
    if (!processorId) missingSettings.push("GOOGLE_DOCUMENT_AI_PROCESSOR_ID");

    if (missingSettings.length > 0) {
      return NextResponse.json(
        { 
          error: {
            code: "OCR_NOT_CONFIGURED",
            message: "Google Document AIの設定が完了していません。",
            missingSettings
          }
        },
        { status: 503 }
      );
    }

    const result = await analyzePageWithOcr(input);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("OCR API Error:", error);
    const msg = error instanceof Error ? error.message : "Failed to process OCR.";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
