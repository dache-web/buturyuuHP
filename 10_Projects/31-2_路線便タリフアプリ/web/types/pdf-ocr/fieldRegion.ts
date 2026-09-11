export type FieldRegionType = "single" | "detail_column";

export interface FieldRegionArea {
  fieldId: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FieldRegionItem {
  id: string;
  name: string;
  type: FieldRegionType;
  color: string;
  area: FieldRegionArea | null;
  originalArea?: FieldRegionArea | null;
  actualArea?: FieldRegionArea | null;
  textElementIds?: string[];
  sourceText?: string;
  elementCount?: number;
  textLength?: number;
}
