export interface SelectionArea {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractionAssignment {
  fieldId: string;
  ruleId: string;
  fieldName: string;
  selectionMethod: string;
  pageNumbers: number[];
  selectedElementIds: string[];
  selectionAreas: SelectionArea[];
  originalText: string;
  editedText: string | null;
  finalText: string;
  joinMethod: string;
  dataType: string;
  isConfirmed: boolean;
  updatedAt: string;
}
