import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { PdfAnalysisData, PageAnalysis, TextElement, DocumentAnalysis } from "@/types/pdfAnalysis";
import { calculateCoordinates } from "./coordinates";

const MIN_TEXT_LENGTH_PER_PAGE = 50;
const MIN_TEXT_ITEMS_PER_PAGE = 10;

export async function extractTextFromPdf(
  file: File
): Promise<PdfAnalysisData> {
  const startedAt = new Date().toISOString();
  const docStartTime = performance.now();
  
  if (typeof window === "undefined") {
    throw new Error("PDF text extraction must run in the browser.");
  }
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDocument = await loadingTask.promise;
  
  try {
    const numPages = pdfDocument.numPages;
    const pages: PageAnalysis[] = [];
  
  let totalElementCount = 0;
  let totalTextLength = 0;
  let pagesWithSufficientText = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const pageStartTime = performance.now();
    const page = await pdfDocument.getPage(pageNum);
    
    // Scale 1.0 viewport is used for normalization
    const viewport = page.getViewport({ scale: 1.0 });
    
    const textContent = await page.getTextContent();
    const elements: TextElement[] = [];
    
    let pageTextLength = 0;
    let readingOrder = 1;
    
    // To reconstruct basic text
    const textLines: string[] = [];
    let currentLine = "";
    let lastY: number | null = null;
    
    for (const item of textContent.items) {
      if (!('str' in item)) continue; // Skip TextMarkedContent
      
      const textItem = item as TextItem;
      const text = textItem.str;
      
      // Skip purely empty items if they have no dimension, but PDF.js often returns spaces
      if (text === "") continue;
      
      const { original, normalized } = calculateCoordinates(textItem, viewport);
      
      const element: TextElement = {
        id: `page-${pageNum}-element-${readingOrder}`,
        pageNumber: pageNum,
        elementType: "text_item",
        text: text,
        readingOrder: readingOrder,
        source: "pdf_text",
        confidence: null, // As requested for direct extraction
        fontName: textItem.fontName,
        hasEOL: textItem.hasEOL,
        originalCoordinates: original,
        normalizedCoordinates: normalized,
      };
      
      elements.push(element);
      pageTextLength += text.length;
      readingOrder++;
      
      // Text reconstruction logic
      const isNewLine = lastY !== null && Math.abs(original.y - lastY) > 5;
      
      if (isNewLine && currentLine.length > 0) {
        textLines.push(currentLine);
        currentLine = text;
      } else {
        // If it's on the same line, just append. Maybe add space if distance is large, but keep it simple
        currentLine += text;
      }
      
      if (textItem.hasEOL) {
        textLines.push(currentLine);
        currentLine = "";
        lastY = null;
      } else {
        lastY = original.y;
      }
    }
    
    if (currentLine.length > 0) {
      textLines.push(currentLine);
    }
    
    const pageText = textLines.join("\n").replace(/\n+/g, "\n");
    
    const processingTimeMs = Math.round(performance.now() - pageStartTime);
    
    let pageType: "text_page" | "sparse_text_page" | "image_page" | "unknown_page" = "unknown_page";
    if (elements.length === 0 && pageTextLength === 0) {
      pageType = "image_page";
    } else if (pageTextLength < MIN_TEXT_LENGTH_PER_PAGE && elements.length < MIN_TEXT_ITEMS_PER_PAGE) {
      pageType = "sparse_text_page";
    } else {
      pageType = "text_page";
    }

    if (pageType === "text_page" || pageType === "sparse_text_page") {
      pagesWithSufficientText++;
    }
    
    totalElementCount += elements.length;
    totalTextLength += pageTextLength;
    
    pages.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      pdfTextResult: {
        text: pageText,
        elements,
        elementCount: elements.length,
        textLength: pageTextLength,
      },
      finalText: pageText,
      pageType,
      processingTimeMs,
    });
  }
  
  let documentType: "text_pdf" | "mixed_pdf" | "image_pdf" | "unknown" = "unknown";
  if (numPages > 0) {
    if (pagesWithSufficientText === numPages) {
      documentType = "text_pdf";
    } else if (pagesWithSufficientText === 0) {
      documentType = "image_pdf";
    } else {
      documentType = "mixed_pdf";
    }
  }

  const docEndTime = performance.now();
  const completedAt = new Date().toISOString();
  
  const documentAnalysis: DocumentAnalysis = {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    pageCount: numPages,
    documentType,
    analysisMethod: "pdf_text",
    startedAt,
    completedAt,
    processingTimeMs: Math.round(docEndTime - docStartTime),
    totalElementCount,
    totalTextLength,
  };
  
  return {
    schemaVersion: "1.0",
    document: documentAnalysis,
    pages,
  };
  } finally {
    if (loadingTask && typeof loadingTask.destroy === "function") {
      await loadingTask.destroy();
    }
  }
}
