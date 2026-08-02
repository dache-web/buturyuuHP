export interface Coordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextAlternative {
  text: string;
  confidence: number;
}

export interface TableCell {
  rowIndex: number;
  colIndex: number;
  text: string;
}

export interface TableAnalysis {
  tableId: string;
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  confidence: number;
  cells: TableCell[];
}

export interface TextElement {
  id: string;
  pageNumber: number;
  elementType: string;
  text: string;
  readingOrder: number;
  source: string;
  confidence: number | null;
  fontName: string;
  hasEOL: boolean;
  originalCoordinates: Coordinates;
  normalizedCoordinates: Coordinates;
  alternatives?: TextAlternative[];
}

export interface PageAnalysis {
  pageNumber: number;
  width: number;
  height: number;
  
  pdfTextResult: {
    text: string;
    elements: TextElement[];
    elementCount: number;
    textLength: number;
  };
  
  ocrResult: {
    status: "not_started" | "pending" | "processing" | "success" | "failed" | "disabled";
    text: string;
    elements: TextElement[];
    elementCount: number;
    textLength: number;
    provider?: string;
    averageConfidence?: number | null;
    error?: string;
    tables?: TableAnalysis[];
  };
  
  editedText?: string | null;
  finalText: string;
  
  pageType: "text_page" | "sparse_text_page" | "image_page" | "unknown_page";
  requiresOcr: boolean;
  processingTimeMs: number;
  warnings?: string[];
}

export interface DocumentAnalysis {
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageCount: number;
  documentType: "text_pdf" | "scanned_pdf" | "mixed_pdf" | "unknown";
  analysisMethod: string;
  startedAt: string;
  completedAt: string;
  processingTimeMs: number;
  totalElementCount: number;
  totalTextLength: number;
  
  // OCR specific fields
  requiresOcrPages?: number[];
  ocrCompletedPages?: number;
  ocrFailedPages?: number;
  ocrProvider?: string;
  totalOcrProcessingTimeMs?: number;
}

export interface PdfAnalysisData {
  schemaVersion: string;
  document: DocumentAnalysis;
  pages: PageAnalysis[];
}
