import { DataConversionResult, DataConversionOutputItem } from "@/lib/dataConversion/types";
import { SelfCheckResult, SelfCheckMetrics, SelfCheckStatus } from "./types";

/**
 * 抽出・変換データに対する自己検収エンジン（SelfCheckEngine）
 * 読取件数、変換前後の件数差、空欄数、重複数、0件異常を判定
 */
export function runSelfCheck(
  rawInputCount: number,
  conversionResult?: DataConversionResult | null
): SelfCheckResult {
  const timestamp = new Date().toISOString();

  if (!conversionResult) {
    const metrics: SelfCheckMetrics = {
      readCount: rawInputCount,
      preConversionCount: 0,
      postConversionCount: 0,
      emptyCount: 0,
      duplicateCount: 0,
      unprocessedCount: rawInputCount,
      isZeroCountError: rawInputCount > 0,
      countMismatch: rawInputCount,
      plannedSaveCount: 0,
      displayCount: 0,
    };
    return {
      status: rawInputCount === 0 ? "normal" : "warning",
      statusLabel: rawInputCount === 0 ? "正常" : "未処理",
      summaryMessage: rawInputCount === 0 ? "データが選択されていません" : "データ整理が未実行です",
      metrics,
      timestamp,
    };
  }

  const items: DataConversionOutputItem[] = conversionResult.items || [];
  const preConversionCount = conversionResult.inputCount ?? rawInputCount;
  const postConversionCount = conversionResult.convertedCount ?? items.length;

  // 1. 空欄件数のカウント
  const emptyCount = items.filter(
    (item) => !item.sourceText || item.sourceText.trim() === "" || !item.convertedValue || item.convertedValue.trim() === ""
  ).length;

  // 2. 重複件数のカウント (元の値または変換後文字列の重複)
  const textSet = new Set<string>();
  let duplicateCount = 0;
  items.forEach((item) => {
    const key = `${item.sourceText.trim()}__${item.convertedValue.trim()}`;
    if (textSet.has(key)) {
      duplicateCount++;
    } else {
      textSet.add(key);
    }
  });

  // 3. 0件異常判定
  const isZeroCountError = rawInputCount > 0 && postConversionCount === 0;

  // 4. 件数差異
  const countMismatch = Math.abs(preConversionCount - postConversionCount);

  // 5. 保存予定件数・表示件数
  const plannedSaveCount = items.filter((item) => item.status !== "error").length;
  const displayCount = items.length;

  // 6. 未処理件数
  const unprocessedCount = Math.max(0, rawInputCount - preConversionCount);

  const metrics: SelfCheckMetrics = {
    readCount: rawInputCount,
    preConversionCount,
    postConversionCount,
    emptyCount,
    duplicateCount,
    unprocessedCount,
    isZeroCountError,
    countMismatch,
    plannedSaveCount,
    displayCount,
  };

  const details: string[] = [];
  let status: SelfCheckStatus = "normal";
  let statusLabel = "正常";
  let summaryMessage = "すべてのデータが正しく読み取られ、欠損なく整理されました。";

  // 判定ロジック
  if (isZeroCountError) {
    status = "error";
    statusLabel = "異常";
    summaryMessage = `【重大問題】${rawInputCount}件読み取りましたが、整理後のデータが0件になりました。`;
    details.push("変換エンジンからの応答アイテムが0件です。");
  } else if (countMismatch > 0) {
    status = "error";
    statusLabel = "異常";
    summaryMessage = `【件数不一致】読み取り${preConversionCount}件に対し、整理結果が${postConversionCount}件（${countMismatch}件欠損）です。`;
    details.push(`入力${preConversionCount}件 ➔ 出力${postConversionCount}件の差分が発生しています。`);
  } else if (emptyCount > Math.floor(rawInputCount * 0.5) && rawInputCount > 0) {
    status = "warning";
    statusLabel = "注意";
    summaryMessage = `【空欄多数】読み取ったデータ${rawInputCount}件中、${emptyCount}件が空欄です。`;
    details.push("空白文字の比率が高いため選択範囲をご確認ください。");
  } else if (duplicateCount > 0) {
    status = "warning";
    statusLabel = "注意";
    summaryMessage = `【重複あり】データ内に${duplicateCount}件の同じ値が含まれています。`;
    details.push("重複データが含まれています。");
  } else if (!conversionResult.success) {
    status = "warning";
    statusLabel = "注意";
    summaryMessage = "管理ルールの適用に一部注意が必要です（簡易変換が適用されました）。";
    if (conversionResult.error) {
      details.push(`通信理由: ${conversionResult.error}`);
    }
  }

  return {
    status,
    statusLabel,
    summaryMessage,
    metrics,
    details,
    timestamp,
  };
}

