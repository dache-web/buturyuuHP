import { PageAnalysis } from "@/types/pdfAnalysis";

export function getActiveResult(page: PageAnalysis, editedText?: string) {
  let text = page.pdfTextResult?.text || "";
  let elements = page.pdfTextResult?.elements || [];
  let method = "pdf_text";
  
  if (page.requiresOcr && page.ocrResult?.status === "success") {
    text = page.ocrResult.text;
    elements = page.ocrResult.elements;
    method = "ocr";
  }
  
  const finalText = editedText !== undefined ? editedText : text;
  
  return { text, elements, method, finalText };
}
