export type DocumentRegionRole =
  | "single_field"
  | "row_header"
  | "column_header"
  | "column_item"
  | "value_area"
  | "note";

export const DOCUMENT_REGION_ROLE_LABELS: Record<DocumentRegionRole, string> = {
  single_field: "単一項目",
  row_header: "行見出し",
  column_header: "列見出し",
  column_item: "列内項目",
  value_area: "値領域",
  note: "注記／条件",
};

export const COMMON_SEMANTIC_CANDIDATES = [
  "重量",
  "サイズ",
  "地域",
  "都道府県",
  "金額",
  "基本運賃",
  "加算額",
  "個数",
  "条件",
  "注記",
];

export interface DocumentRegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentRegion {
  id: string;
  role: DocumentRegionRole;
  semanticType: string;
  page: number;
  bounds: DocumentRegionBounds;
  originalBounds?: DocumentRegionBounds | null;
  actualBounds?: DocumentRegionBounds | null;
  readOffset?: { x: number; y: number } | null;
  sourceText: string;
  elementCount?: number;
  textLength?: number;
  registrationOrder: number;
  color: string;
  textElementIds?: string[];
}

export interface StructuredDocumentOutput {
  sourceFile: string;
  pageCount: number;
  createdAt: string;
  regions: DocumentRegion[];
}

/**
 * 次のタリフアプリへ受け渡す「どこから読んだ何の値か」を追跡可能な標準データ構造
 * 運賃計算・推測演算を行わず、PDFから読み取った生の文字と座標・位置関係を保持
 */
export interface PdfExtractionOutputItem {
  fileId: string;
  page: number;
  itemName: string;
  rawText: string;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row?: number | null;
  column?: number | null;
  readingUncertain: boolean;
}

export interface PdfExtractionTransferData {
  fileId: string;
  fileName: string;
  pageCount: number;
  extractedAt: string;
  items: PdfExtractionOutputItem[];
}

