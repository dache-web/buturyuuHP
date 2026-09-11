/**
 * 自己検収エンジン (37_自己検収エンジンアプリ release-v1.0.0) 共通接続規格
 * ドキュメント: COMMON_INTEGRATION_CONTRACT.md
 */

export type CommonCheckType =
  | "EQUALS"
  | "NOT_EQUALS"
  | "CONTAINS"
  | "NOT_EMPTY"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "BETWEEN"
  | "REGEX_MATCH"
  | "ARRAY_LENGTH"
  | "IS_TRUE"
  | "IS_FALSE";

export type CommonBusinessStatus = "PASS" | "WARNING" | "FAIL" | "SYSTEM ERROR";
export type CommonMetaStatus = "PASS" | "FAIL";

export interface CommonValidationTestCase {
  testNo: string;
  testName: string;
  targetName: string;
  checkType: CommonCheckType;
  expectedValue: unknown;
  actualValue: unknown;
  expectedBusinessStatus?: CommonBusinessStatus;
  mismatchLevel?: "WARNING" | "FAIL";
}

export interface CommonValidationRequest {
  appId: string;       // 例: "APP_PDF_OCR"
  appName: string;     // 例: "PDF解析アプリ"
  runId: string;       // 例: "RUN_20260910_001"
  testCases: CommonValidationTestCase[];
}

export interface CommonValidationSummary {
  total: number;
  bizPass: number;
  bizWarning: number;
  bizFail: number;
  bizSystemError: number;
  metaPass: number;
  metaFail: number;
}

export interface CommonValidationTestResultItem {
  testNo: string;
  testName: string;
  targetName: string;
  checkType: CommonCheckType;
  expectedVal: unknown;
  actualVal: unknown;
  expectedBiz: CommonBusinessStatus;
  actualBiz: CommonBusinessStatus;
  metaStatus: CommonMetaStatus;
  reasonShort: string;
  mismatchLevel: "WARNING" | "FAIL";
  systemError: boolean;
  checkedAt: string;
}

export interface CommonValidationResult {
  success: boolean;
  overallSuccess: boolean;
  appId: string;
  appName: string;
  runId: string;
  execTime: string;
  summary: CommonValidationSummary;
  testResults: CommonValidationTestResultItem[];
  errors?: string[];
}

