export interface DataConversionInputItem {
  id?: string;
  sourcePdfName?: string;
  pageNumber?: number;
  sourceText: string;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fieldName?: string;
  role?: string;
  meaning?: string;
  value?: string;
  region?: string;
  weight?: string | number;
  fare?: number;
  conditions?: Record<string, unknown>;
}

export interface DataConversionInputPayload {
  sourcePdfName?: string;
  pageNumber?: number;
  ruleId?: string;
  items: DataConversionInputItem[];
}

export interface DataConversionOutputItem {
  id: string;
  sourceText: string;
  convertedValue: string;
  fieldName?: string;
  meaning?: string;
  ruleMatched?: boolean;
  matchedFieldId?: string;
  dataType?: string;
  status: "success" | "warning" | "error";
  note?: string;
}

export interface DataConversionResult {
  success: boolean;
  conversionModeLabel: string; // "管理ルール適用" または "簡易変換（管理ルール取得失敗）"
  rulesCount: number;
  fieldsCount: number;
  settingsLoaded: boolean;
  inputCount: number;
  convertedCount: number;
  items: DataConversionOutputItem[];
  error?: string;
  timestamp: string;
}

