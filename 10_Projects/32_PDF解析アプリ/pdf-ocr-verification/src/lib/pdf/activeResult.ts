import { PageAnalysis } from "@/types/pdfAnalysis";

export function getActiveResult(page: PageAnalysis, editedText?: string) {
  const text = page.pdfTextResult?.text || "";
  const elements = page.pdfTextResult?.elements || [];
  const method = "pdf_text";
  
  const finalText = editedText !== undefined ? editedText : text;
  
  return { text, elements, method, finalText };
}
