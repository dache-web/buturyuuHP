import {
  BusinessRuleRequest,
  BusinessRuleResult,
  BusinessRuleResultItem,
  BusinessRuleStatus,
} from "./contract";

/**
 * 業務ルールエンジン (Business Rule Engine) の評価コア関数
 * 完成済み契約規格に従ってリクエストを検証し結果を出力する純粋関数
 */
export function runBusinessRuleValidationCore(req: BusinessRuleRequest): BusinessRuleResult {
  const timestamp = new Date().toISOString();
  const details: BusinessRuleResultItem[] = [];

  let passCount = 0;
  let warningCount = 0;
  let failCount = 0;

  for (const rule of req.rules) {
    let status: BusinessRuleStatus = "PASS";
    let message = "業務ルール適合: 正常な業務基準を満たしています。";

    if (rule.ruleType === "REQUIRED_FIELD") {
      const valStr = String(rule.value ?? "").trim();
      if (valStr === "") {
        status = "FAIL";
        message = "業務必須違反: 必須データ要素が空欄です。";
      }
    } else if (rule.ruleType === "NUMERIC_FORMAT") {
      const num = Number(rule.value);
      if (isNaN(num)) {
        status = "WARNING";
        message = "フォーマット注意: 非数値テキストが検出されました。";
      }
    } else if (rule.ruleType === "BUSINESS_RANGE") {
      const num = Number(rule.value);
      if (num < 0) {
        status = "FAIL";
        message = "範囲違反: マイナス値は業務上無効です。";
      }
    } else if (rule.ruleType === "DATA_RELATION") {
      if (rule.value === false) {
        status = "WARNING";
        message = "整合性注意: 関連項目との整合性が未検証です。";
      }
    }

    if (status === "PASS") passCount++;
    else if (status === "WARNING") warningCount++;
    else if (status === "FAIL") failCount++;

    details.push({
      id: rule.id,
      ruleName: rule.ruleName,
      fieldName: rule.fieldName,
      ruleType: rule.ruleType,
      status,
      message,
      evaluatedAt: timestamp,
    });
  }

  const total = req.rules.length;
  const complianceRate = total > 0 ? Math.round((passCount / total) * 100) : 100;

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
      complianceRate,
    },
    details,
    timestamp,
  };
}

