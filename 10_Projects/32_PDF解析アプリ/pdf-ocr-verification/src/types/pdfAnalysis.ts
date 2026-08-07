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

export type OcrStatus = 'not_required' | 'pending' | 'ready' | 'processing' | 'success' | 'failed' | 'disabled';

export interface OcrResult {
  status: OcrStatus;
  pageNumber: number;
  text?: string;
  elements?: TextElement[];
  confidence?: number;
  processingTime?: number;
  errorMessage?: string;
  provider?: string;
  debugInfo?: any;
}

export interface TableColumn {
  columnId: string;
  columnName?: string;
  xStart: number;
  xEnd: number;
  displayOrder: number;
  isExcluded?: boolean;
}

export interface TableCell {
  columnId: string;
  originalText: string;
  editedText?: string;
  finalText: string;
  sourceElementIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number | null;
}

export interface TableRow {
  rowId: string;
  pageNumber: number;
  rowOrder: number;
  cells: TableCell[];
  sourceElementIds: string[];
  isExcluded?: boolean;
}

export interface TableAnalysis {
  tableId: string;
  pageNumber: number;
  columnCount: number;
  rowCount: number;
  columns: TableColumn[];
  rows: TableRow[];
  confidence: number;
  tableScore?: number;
  tableReasons?: string[];
  tableWarnings?: string[];
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

export type PageType = "text" | "table_candidate" | "image" | "mixed" | "blank" | "unknown" | "text_page" | "sparse_text_page" | "image_page" | "unknown_page";

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
  
  hasPdfText?: boolean;
  hasImageOperators?: boolean;
  canvasRenderSucceeded?: boolean;
  classificationReason?: string;
  
  pageType: PageType;
  
  tableResult?: TableAnalysis;
  ocrResult?: OcrResult;
  
  editedText?: string | null;
  finalText: string;
  
  processingTimeMs: number;
  warnings?: string[];
}

export interface DocumentAnalysis {
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageCount: number;
  documentType: "text_pdf" | "mixed_pdf" | "image_pdf" | "unknown";
  analysisMethod: string;
  startedAt: string;
  completedAt: string;
  processingTimeMs: number;
  totalElementCount: number;
  totalTextLength: number;
}

export interface PdfAnalysisData {
  schemaVersion: string;
  document: DocumentAnalysis;
  pages: PageAnalysis[];
}
