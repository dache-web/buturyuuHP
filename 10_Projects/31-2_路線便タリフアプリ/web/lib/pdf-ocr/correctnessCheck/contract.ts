/**
 * 正しさ確認エンジン (Correctness Check Engine) 共通接続規格
 * ドキュメント: COMMON_INTEGRATION_CONTRACT.md 互換
 */

export type CorrectnessCheckType =
  | "DATA_FORMAT"       // データ形式チェック
  | "VALUE_RANGE"       // 数値範囲妥当性チェック
  | "FIELD_COMPLETENESS"// 必須項目完備チェック
  | "DUPLICATE_CHECK"   // 重複妥当性チェック
  | "RULE_MATCH";       // 適用ルール整合性チェック

export type CorrectnessStatus = "PASS" | "WARNING" | "FAIL";

export interface CorrectnessTestCase {
  id: string;
  name: string;
  targetField: string;
  checkType: CorrectnessCheckType;
  value: unknown;
  expectedCondition: string;
  status?: CorrectnessStatus;
  message?: string;
}

export interface CorrectnessRequest {
  appId: string;       // 例: "APP_PDF_OCR"
  appName: string;     // 例: "PDF解析アプリ"
  runId: string;       // 例: "RUN_CORRECTNESS_20260910_001"
  testCases: CorrectnessTestCase[];
}

export interface CorrectnessSummary {
  total: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  accuracyScore: number; // 0 ~ 100%
}

export interface CorrectnessResultItem {
  id: string;
  name: string;
  targetField: string;
  checkType: CorrectnessCheckType;
  status: CorrectnessStatus;
  message: string;
  evaluatedAt: string;
}

export interface CorrectnessResult {
  success: boolean;
  overallStatus: "正常" | "注意" | "異常";
  appId: string;
  appName: string;
  runId: string;
  summary: CorrectnessSummary;
  details: CorrectnessResultItem[];
  timestamp: string;
}

/**
 * 正式な正しさ確認エンジン (gas/PdfConnector.gs) への受取規格インターフェース
 */
export interface PdfConnectorSource {
  sourceId: string;
  sourceName: string;
  fileId?: string;
  saveLocation?: string;
  validFrom?: string;
  validTo?: string;
  currentSource?: string;
  note?: string;
}

export interface PdfConnectorRecord {
  checkId?: string;
  targetApp?: string;
  recordId?: string;
  itemName: string;
  valueType: "金額" | "重量" | "文字" | "個数" | "数値" | string;
  extractedValue: unknown;
  rawText: string;
  page?: number | string;
  row?: number | string;
  column?: number | string;
  x?: number | string;
  y?: number | string;
  region?: string;
  weight?: string;
  size?: string;
  count?: string;
  extraCharge?: string;
  conditionsComplete?: boolean;
  readingUncertain?: boolean;
}

export interface PdfConnectorPayload {
  source: PdfConnectorSource;
  records: PdfConnectorRecord[];
}

export interface ExternalCorrectnessResult {
  success: boolean;
  overallStatusLabel: "正常" | "確認が必要" | "エラー";
  summaryText: string;
  importedCount: number;
  errorCount: number;
  details: Array<{
    itemName: string;
    valueType: string;
    rawText: string;
    extractedValue: unknown;
    status: "正常" | "確認が必要";
    message: string;
    page?: number | string;
  }>;
}


