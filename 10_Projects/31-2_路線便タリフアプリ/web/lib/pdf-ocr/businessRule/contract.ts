/**
 * 業務ルールエンジン (Business Rule Engine) 共通接続規格
 * ドキュメント: COMMON_INTEGRATION_CONTRACT.md 互換
 */

export type BusinessRuleType =
  | "REQUIRED_FIELD"   // 必須項目チェック
  | "NUMERIC_FORMAT"   // 数値型フォーマットチェック
  | "BUSINESS_RANGE"   // 業務閾値範囲チェック
  | "DATA_RELATION";   // 関連項目整合性チェック

export type BusinessRuleStatus = "PASS" | "WARNING" | "FAIL";

export interface BusinessRuleTestCase {
  id: string;
  ruleName: string;
  fieldName: string;
  ruleType: BusinessRuleType;
  value: unknown;
  expectedRule: string;
}

export interface BusinessRuleRequest {
  appId: string;       // 例: "APP_PDF_OCR"
  appName: string;     // 例: "PDF解析アプリ"
  runId: string;       // 例: "RUN_RULE_20260910_001"
  rules: BusinessRuleTestCase[];
}

export interface BusinessRuleSummary {
  total: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  complianceRate: number; // 0 ~ 100%
}

export interface BusinessRuleResultItem {
  id: string;
  ruleName: string;
  fieldName: string;
  ruleType: BusinessRuleType;
  status: BusinessRuleStatus;
  message: string;
  evaluatedAt: string;
}

export interface BusinessRuleResult {
  success: boolean;
  overallStatus: "正常" | "注意" | "異常";
  appId: string;
  appName: string;
  runId: string;
  summary: BusinessRuleSummary;
  details: BusinessRuleResultItem[];
  timestamp: string;
}

