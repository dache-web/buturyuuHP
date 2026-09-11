import { DataConversionResult } from "@/lib/dataConversion/types";
import { BusinessRuleRequest, BusinessRuleResult, BusinessRuleTestCase } from "./contract";
import { runBusinessRuleValidationCore } from "./coreEngine";

export interface BusinessRuleAdapterResult {
  businessRuleResult: BusinessRuleResult;
  userSummary: {
    overallStatusLabel: string; // "正常" | "注意" | "異常"
    summaryText: string;
    complianceRate: number;
    passCount: number;
    warningCount: number;
    failCount: number;
  };
}

/**
 * PDF解析アプリデータを業務ルールエンジンの共通統合規格へ変換し、
 * 業務ルール検証コアへ渡す接着アダプター (BusinessRuleAdapter)
 */
export function runPdfBusinessRuleAdapter(
  rawInputCount: number,
  conversionResult?: DataConversionResult | null
): BusinessRuleAdapterResult {
  const runId = `RUN_BUSINESSRULE_${Date.now()}`;
  const items = conversionResult?.items || [];

  // 1. 接続確認用の最小 rules 構築
  const rules: BusinessRuleTestCase[] = [
    {
      id: "BR-01",
      ruleName: "入力データ存在チェック",
      fieldName: "読取要素数",
      ruleType: "REQUIRED_FIELD",
      value: rawInputCount > 0 ? rawInputCount : "",
      expectedRule: "要素数が1件以上であること",
    },
    {
      id: "BR-02",
      ruleName: "変換処理結果範囲チェック",
      fieldName: "変換アイテム数",
      ruleType: "BUSINESS_RANGE",
      value: items.length,
      expectedRule: "変換件数が非負整数であること",
    },
    {
      id: "BR-03",
      ruleName: "ルールマスタ適用チェック",
      fieldName: "変換モード",
      ruleType: "DATA_RELATION",
      value: conversionResult ? conversionResult.conversionModeLabel === "管理ルール適用" : false,
      expectedRule: "管理ルールが正常適用されていること",
    },
  ];

  const request: BusinessRuleRequest = {
    appId: "APP_PDF_OCR",
    appName: "PDF解析アプリ",
    runId,
    rules,
  };

  // 2. 業務ルールエンジンコアの呼び出し
  const businessRuleResult = runBusinessRuleValidationCore(request);

  // 3. 画面表示向けサマリーの生成
  let summaryText = "業務ルール適合確認が完了しました。";
  if (businessRuleResult.overallStatus === "異常") {
    summaryText = "【警告】業務ルール違反が検出されました。";
  } else if (businessRuleResult.overallStatus === "注意") {
    summaryText = "【注意】業務ルール注意項目が含まれています。";
  }

  return {
    businessRuleResult,
    userSummary: {
      overallStatusLabel: businessRuleResult.overallStatus,
      summaryText,
      complianceRate: businessRuleResult.summary.complianceRate,
      passCount: businessRuleResult.summary.passCount,
      warningCount: businessRuleResult.summary.warningCount,
      failCount: businessRuleResult.summary.failCount,
    },
  };
}

