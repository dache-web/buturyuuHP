import { DataConversionResult } from "@/lib/dataConversion/types";
import { CommonValidationRequest, CommonValidationResult, CommonValidationTestCase } from "./contract";
import { runValidationCore } from "./coreEngine";

export interface SelfCheckAdapterResult {
  commonResult: CommonValidationResult;
  userSummary: {
    overallStatusLabel: string; // "正常" | "注意" | "異常"
    summaryText: string;
    readCount: number;
    convertedCount: number;
    emptyCount: number;
    duplicateCount: number;
    unprocessedCount: number;
    passCount: number;
    warningCount: number;
    failCount: number;
  };
}

/**
 * PDF解析アプリデータを COMMON_INTEGRATION_CONTRACT (37_自己検収エンジンアプリ release-v1.0.0) 規格へ変換し、
 * 完成版検証コアへ受け渡す接着剤アダプター (SelfCheckAdapter)
 */
export function runPdfSelfCheckAdapter(
  rawInputCount: number,
  conversionResult?: DataConversionResult | null
): SelfCheckAdapterResult {
  const runId = `RUN_PDF_${Date.now()}`;
  const items = conversionResult?.items || [];
  const convertedCount = conversionResult?.convertedCount ?? items.length;

  // 1. メトリクス集計
  const emptyCount = items.filter(
    (it) => !it.sourceText || it.sourceText.trim() === "" || !it.convertedValue || it.convertedValue.trim() === ""
  ).length;

  const textSet = new Set<string>();
  let duplicateCount = 0;
  items.forEach((it) => {
    const key = `${it.sourceText.trim()}__${it.convertedValue.trim()}`;
    if (textSet.has(key)) {
      duplicateCount++;
    } else {
      textSet.add(key);
    }
  });

  const unprocessedCount = Math.max(0, rawInputCount - (conversionResult?.inputCount ?? rawInputCount));

  // 2. COMMON_INTEGRATION_CONTRACT 規格の testCases 構築
  const testCases: CommonValidationTestCase[] = [
    {
      testNo: "TC-PDF-001",
      testName: "データ要素存在チェック",
      targetName: "読取要素件数",
      checkType: "GREATER_THAN",
      expectedValue: 0,
      actualValue: rawInputCount,
      expectedBusinessStatus: "PASS",
      mismatchLevel: "FAIL",
    },
    {
      testNo: "TC-PDF-002",
      testName: "読取と整理後件数一致チェック",
      targetName: "整理後件数",
      checkType: "EQUALS",
      expectedValue: rawInputCount,
      actualValue: convertedCount,
      expectedBusinessStatus: "PASS",
      mismatchLevel: "FAIL",
    },
    {
      testNo: "TC-PDF-003",
      testName: "変換レスポンス配列長チェック",
      targetName: "変換アイテム配列",
      checkType: "ARRAY_LENGTH",
      expectedValue: rawInputCount,
      actualValue: items,
      expectedBusinessStatus: "PASS",
      mismatchLevel: "FAIL",
    },
    {
      testNo: "TC-PDF-004",
      testName: "データ空欄率非超過チェック",
      targetName: "空欄アイテム数",
      checkType: "IS_TRUE",
      expectedValue: true,
      actualValue: rawInputCount === 0 || emptyCount <= Math.floor(rawInputCount * 0.5),
      expectedBusinessStatus: "PASS",
      mismatchLevel: "WARNING",
    },
    {
      testNo: "TC-PDF-005",
      testName: "データ重複非存在チェック",
      targetName: "重複アイテム数",
      checkType: "IS_TRUE",
      expectedValue: true,
      actualValue: duplicateCount === 0,
      expectedBusinessStatus: "PASS",
      mismatchLevel: "WARNING",
    },
    {
      testNo: "TC-PDF-006",
      testName: "データ整理成功ステータスチェック",
      targetName: "整理API実行状態",
      checkType: "IS_TRUE",
      expectedValue: true,
      actualValue: conversionResult ? conversionResult.success : false,
      expectedBusinessStatus: "PASS",
      mismatchLevel: "WARNING",
    },
  ];

  const request: CommonValidationRequest = {
    appId: "APP_PDF_OCR",
    appName: "PDF解析アプリ",
    runId,
    testCases,
  };

  // 3. 完成版判定コア (runValidationCore) の実行
  const commonResult = runValidationCore(request);

  // 4. 画面向け要約ラベルの生成
  let overallStatusLabel = "正常";
  let summaryText = "全判定項目（共通契約規格）を合格しました。欠損なく正常に整理されています。";

  if (commonResult.summary.bizFail > 0 || commonResult.summary.bizSystemError > 0) {
    overallStatusLabel = "異常";
    summaryText = `【重大警告】判定項目${commonResult.summary.total}件中 ${commonResult.summary.bizFail}件の異常が検知されました。`;
  } else if (commonResult.summary.bizWarning > 0) {
    overallStatusLabel = "注意";
    summaryText = `【注意】判定項目${commonResult.summary.total}件中 ${commonResult.summary.bizWarning}件の注意項目があります。`;
  }

  return {
    commonResult,
    userSummary: {
      overallStatusLabel,
      summaryText,
      readCount: rawInputCount,
      convertedCount,
      emptyCount,
      duplicateCount,
      unprocessedCount,
      passCount: commonResult.summary.bizPass,
      warningCount: commonResult.summary.bizWarning,
      failCount: commonResult.summary.bizFail,
    },
  };
}

