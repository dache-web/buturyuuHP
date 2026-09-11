import {
  CorrectnessRequest,
  CorrectnessResult,
  CorrectnessResultItem,
  CorrectnessStatus,
} from "./contract";

/**
 * 正しさ確認エンジン (Correctness Check Engine) の評価コア関数
 * 完成済み契約規格に従ってリクエストを検証し結果を出力する純粋関数
 */
export function runCorrectnessValidationCore(req: CorrectnessRequest): CorrectnessResult {
  const timestamp = new Date().toISOString();
  const details: CorrectnessResultItem[] = [];

  let passCount = 0;
  let warningCount = 0;
  let failCount = 0;

  for (const tc of req.testCases) {
    let status: CorrectnessStatus = "PASS";
    let message = "妥当性検証 成功: 正常な条件を満たしています。";

    // 評価判定処理 (契約型チェック)
    if (tc.checkType === "FIELD_COMPLETENESS") {
      const isPresent = tc.value !== null && tc.value !== undefined && String(tc.value).trim() !== "";
      if (!isPresent) {
        status = "FAIL";
        message = "欠損エラー: 必須項目が空欄または未設定です。";
      }
    } else if (tc.checkType === "VALUE_RANGE") {
      const num = Number(tc.value);
      if (isNaN(num) || num < 0) {
        status = "WARNING";
        message = "範囲注意: 数値範囲が想定の適正値外です。";
      }
    } else if (tc.checkType === "DATA_FORMAT") {
      const strVal = String(tc.value ?? "");
      if (strVal.length === 0) {
        status = "WARNING";
        message = "形式注意: フォーマット定義が未検証です。";
      }
    } else if (tc.checkType === "DUPLICATE_CHECK") {
      if (tc.value === false || tc.value === 0) {
        status = "PASS";
        message = "重複なし: 一意性が保たれています。";
      } else if (tc.value === true) {
        status = "WARNING";
        message = "重複注意: 同一要素の検出が記録されました。";
      }
    } else if (tc.checkType === "RULE_MATCH") {
      if (tc.value === false) {
        status = "WARNING";
        message = "ルール未適用: 標準デフォルト変換が適用されています。";
      }
    }

    if (status === "PASS") passCount++;
    else if (status === "WARNING") warningCount++;
    else if (status === "FAIL") failCount++;

    details.push({
      id: tc.id,
      name: tc.name,
      targetField: tc.targetField,
      checkType: tc.checkType,
      status,
      message,
      evaluatedAt: timestamp,
    });
  }

  const total = req.testCases.length;
  const accuracyScore = total > 0 ? Math.round(((passCount + warningCount * 0.5) / total) * 100) : 100;

  let overallStatus: "正常" | "注意" | "異常" = "正常";
  if (failCount > 0) {
    overallStatus = "異常";
  } else if (warningCount > 0) {
    overallStatus = "注意";
  }

  return {
    success: failCount === 0,
    overallStatus,
    appId: req.appId,
    appName: req.appName,
    runId: req.runId,
    summary: {
      total,
      passCount,
      warningCount,
      failCount,
      accuracyScore,
    },
    details,
    timestamp,
  };
}

