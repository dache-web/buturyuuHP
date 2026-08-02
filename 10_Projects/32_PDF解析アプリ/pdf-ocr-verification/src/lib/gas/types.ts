export interface AppSettings {
  appName: string;
  fullTextExtraction: boolean;
  defaultRuleId: string;
  outputMode: string;
  ocrEnabled: boolean;
  schemaVersion: number;
}

export interface ExtractionRule {
  ruleId: string;
  ruleName: string;
  ruleCategory: string;
  usage: string;
  outputMethod: string;
  outputId: string;
  isActive: boolean;
  displayOrder: number;
}

export interface ExtractionField {
  fieldId: string;
  ruleId: string;
  fieldName: string;
  description: string;
  selectionMethod: string;
  extractionUnit: string;
  allowMultiple: boolean;
  joinMethod: string;
  dataType: string;
  isRequired: boolean;
  outputColumnName: string;
  displayOrder: number;
  isActive: boolean;
}

export interface OutputSetting {
  outputId: string;
  ruleId: string;
  spreadsheetId: string;
  sheetName: string;
  outputMethod: string;
  headerRow: number;
  startColumn: string;
  outputFileName: boolean;
  outputImportDate: boolean;
  outputPageNumber: boolean;
  allowOverwrite: boolean;
  isActive: boolean;
}

export interface ChoiceItem {
  type: string;
  value: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
}

export interface GasApiSuccessResponse<T> {
  success: true;
  data: T;
  error: null;
  timestamp: string;
}

export interface GasApiError {
  code: string;
  message: string;
}

export interface GasApiErrorResponse {
  success: false;
  data: null;
  error: GasApiError;
  timestamp: string;
}

export type GasApiResponse<T> = GasApiSuccessResponse<T> | GasApiErrorResponse;
