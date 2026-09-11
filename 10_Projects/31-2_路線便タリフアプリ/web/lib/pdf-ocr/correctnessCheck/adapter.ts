import { DataConversionResult } from "@/lib/dataConversion/types";
import { CorrectnessRequest, CorrectnessResult, CorrectnessTestCase } from "./contract";
import { runCorrectnessValidationCore } from "./coreEngine";

export interface CorrectnessAdapterResult {
  correctnessResult: CorrectnessResult;
  userSummary: {
    overallStatusLabel: string; // "正常" | "注意" | "異常"
    summaryText: string;
    score: number;
    passCount: number;
    warningCount: number;
    failCount: number;
  };
}

/**
 * PDF解析アプリデータを正しさ確認エンジンの共通統合規格へ変換し、
 * 正しさ検証コアへ渡す接着アダプター (CorrectnessAdapter)
 */
export function runPdfCorrectnessAdapter(
  rawInputCount: number,
  conversionResult?: DataConversionResult | null
): CorrectnessAdapterResult {
  const runId = `RUN_CORRECTNESS_${Date.now()}`;
  const items = conversionResult?.items || [];

  // 1. 接続確認用の最小 testCases 構築
  const testCases: CorrectnessTestCase[] = [
    {
      id: "CC-01",
      name: "要素存在妥当性チェック",
      targetField: "読取要素数",
      checkType: "FIELD_COMPLETENESS",
      value: rawInputCount > 0 ? rawInputCount : "",
      expectedCondition: "読取要素が存在すること",
    },
    {
      id: "CC-02",
      name: "データ変換実行件数範囲チェック",
      targetField: "変換処理件数",
      checkType: "VALUE_RANGE",
      value: items.length,
      expectedCondition: "変換件数が適正範囲内であること",
    },
    {
      id: "CC-03",
      name: "管理ルール適用整合性チェック",
      targetField: "データ変換ルール",
      checkType: "RULE_MATCH",
      value: conversionResult ? conversionResult.conversionModeLabel === "管理ルール適用" : false,
      expectedCondition: "管理ルールが正常適用されていること",
    },
  ];

  const request: CorrectnessRequest = {
    appId: "APP_PDF_OCR",
    appName: "PDF解析アプリ",
    runId,
    testCases,
  };

  // 2. 正しさ確認エンジンコアの呼び出し
  const correctnessResult = runCorrectnessValidationCore(request);

  // 3. 画面表示向けサマリーの生成
  let summaryText = "全妥当性判定項目をクリアしました。データ形式は正常です。";
  if (correctnessResult.overallStatus === "異常") {
    summaryText = `【警告】正しさ確認項目で欠損・エラーが検出されました。`;
  } else if (correctnessResult.overallStatus === "注意") {
    summaryText = `【注意】正しさ確認項目の一部に注意項目が含まれています。`;
  }

  return {
    correctnessResult,
    userSummary: {
      overallStatusLabel: correctnessResult.overallStatus,
      summaryText,
      score: correctnessResult.summary.accuracyScore,
      passCount: correctnessResult.summary.passCount,
      warningCount: correctnessResult.summary.warningCount,
      failCount: correctnessResult.summary.failCount,
    },
  };
}

import { SeinoStructuredTariffResult } from "@/lib/pdf-ocr/pdf/seinoTariffParser";
import { PdfConnectorPayload, PdfConnectorRecord, ExternalCorrectnessResult } from "./contract";

/**
 * 西濃タリフ読取結果 (SeinoStructuredTariffResult) から
 * 正式な正しさ確認エンジン (gas/PdfConnector.gs) の受取規格 payload を生成する関数
 */
export function buildSeinoCorrectnessPayload(
  seinoResult: SeinoStructuredTariffResult,
  pageNumber: number = 1,
  docName: string = "西濃運輸タリフ"
): PdfConnectorPayload {
  const records: PdfConnectorRecord[] = [];
  const timestampStr = new Date().toISOString().substring(0, 10);

  // 1. 対象地域レコード (距離ごとの対象地域)
  seinoResult.distanceGroups.forEach((group, idx) => {
    const rawText = group.destinations.join(", ");
    records.push({
      checkId: `SEINO-DST-${idx + 1}`,
      targetApp: "PDF解析アプリ",
      recordId: `REC-DST-${group.groupId}`,
      itemName: `対象地域 (${group.distanceText})`,
      valueType: "文字",
      extractedValue: group.destinations,
      rawText: rawText || "地域未指定",
      page: pageNumber,
      column: idx + 1,
      region: group.distanceText,
      conditionsComplete: group.destinations.length > 0 && !group.destinations.includes("地域未指定"),
      readingUncertain: group.destinations.length === 0 || group.destinations.includes("地域未指定"),
    });
  });

  // 2. 重量行レコード
  seinoResult.weightRows.forEach((row, idx) => {
    records.push({
      checkId: `SEINO-WGT-${idx + 1}`,
      targetApp: "PDF解析アプリ",
      recordId: `REC-WGT-${idx + 1}`,
      itemName: `重量区分`,
      valueType: "重量",
      extractedValue: row.weightKg > 0 ? row.weightKg : row.weightText,
      rawText: row.weightText,
      page: pageNumber,
      row: idx + 1,
      weight: row.weightText,
      conditionsComplete: row.weightKg > 0,
      readingUncertain: false,
    });
  });

  // 3. 運賃セルレコード (重量 × 距離 ➔ 運賃)
  seinoResult.rates.forEach((rate, idx) => {
    const isUncertain = rate.fareYen === null || !rate.fareText;
    records.push({
      checkId: `SEINO-FARE-${idx + 1}`,
      targetApp: "PDF解析アプリ",
      recordId: `REC-FARE-${idx + 1}`,
      itemName: `運賃 (${rate.distanceText} / ${rate.weightText})`,
      valueType: "金額",
      extractedValue: rate.fareYen ?? rate.fareText,
      rawText: rate.fareText,
      page: pageNumber,
      region: rate.distanceText,
      weight: rate.weightText,
      conditionsComplete: !isUncertain,
      readingUncertain: isUncertain,
    });
  });

  return {
    source: {
      sourceId: `PDF_SEINO_${timestampStr}`,
      sourceName: docName,
      fileId: "DOC_SEINO_TARIFF_001",
      validFrom: timestampStr,
      note: "西濃運輸タリフ構造化解析結果",
    },
    records,
  };
}

/**
 * 西濃タリフ結果を正式正しさ確認エンジン規格へ連携し、結果を画面表示用形式で返す
 */
export function runSeinoCorrectnessIntegration(
  seinoResult: SeinoStructuredTariffResult,
  pageNumber: number = 1,
  docName: string = "西濃運輸タリフ"
): ExternalCorrectnessResult {
  if (!seinoResult || !seinoResult.success) {
    return {
      success: false,
      overallStatusLabel: "確認が必要",
      summaryText: "西濃タリフ構造化データが取得できていないため確認を実行できません。",
      importedCount: 0,
      errorCount: 1,
      details: [
        {
          itemName: "西濃タリフ構造データ",
          valueType: "文字",
          rawText: "-",
          extractedValue: null,
          status: "確認が必要",
          message: "西濃タリフの読取データが存在しません。",
          page: pageNumber,
        },
      ],
    };
  }

  const payload = buildSeinoCorrectnessPayload(seinoResult, pageNumber, docName);
  
  // エンジン側の判定基準に合わせた各レコードの診断集計
  let errorCount = 0;
  const details = payload.records.map((r) => {
    const hasIssue = r.conditionsComplete === false || r.readingUncertain === true;
    if (hasIssue) errorCount++;
    return {
      itemName: r.itemName,
      valueType: r.valueType,
      rawText: r.rawText,
      extractedValue: r.extractedValue,
      status: hasIssue ? ("確認が必要" as const) : ("正常" as const),
      message: hasIssue
        ? "読取不安または必要条件不備が検出されました。原本と照合してください。"
        : "正常に構造化・抽出されました。",
      page: r.page,
    };
  });

  const isOverallPass = errorCount === 0;

  return {
    success: true,
    overallStatusLabel: isOverallPass ? "正常" : "確認が必要",
    summaryText: isOverallPass
      ? `【正常】正しさ確認エンジン規格の全${payload.records.length}項目の検証が完了しました。`
      : `【確認が必要】全${payload.records.length}項目中 ${errorCount}件の確認必要項目が含まれています。`,
    importedCount: payload.records.length,
    errorCount,
    details,
  };
}

import { sendToExternalCorrectnessEngine } from "./client";

/**
 * 西濃タリフ結果を正式正しさ確認エンジンへ送信・実行し、結果を非同期で返す
 */
export async function runSeinoCorrectnessIntegrationAsync(
  seinoResult: SeinoStructuredTariffResult,
  pageNumber: number = 1,
  docName: string = "西濃運輸タリフ"
): Promise<ExternalCorrectnessResult> {
  if (!seinoResult || !seinoResult.success) {
    return {
      success: false,
      overallStatusLabel: "確認が必要",
      summaryText: "西濃タリフ構造化データが取得できていないため確認を実行できません。",
      importedCount: 0,
      errorCount: 1,
      details: [],
    };
  }

  const payload = buildSeinoCorrectnessPayload(seinoResult, pageNumber, docName);
  return await sendToExternalCorrectnessEngine(payload);
}



