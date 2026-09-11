import {
  CommonValidationRequest,
  CommonValidationResult,
  CommonValidationTestResultItem,
  CommonValidationSummary,
  CommonCheckType,
  CommonBusinessStatus,
} from "./contract";

/**
 * 37_自己検収エンジンアプリ (release-v1.0.0 ValidationInterface.gs) の完成版判定コア
 * 11種類の checkType による比較判定、業務ステータス (actualBiz)、メタステータス (metaStatus)、overallSuccessの評価を行う。
 */
export function runValidationCore(request: CommonValidationRequest): CommonValidationResult {
  const nowDate = new Date();
  const execTimeStr = nowDate.toISOString();

  if (!request || !Array.isArray(request.testCases)) {
    return {
      success: false,
      overallSuccess: false,
      appId: request?.appId || "APP_PDF_OCR",
      appName: request?.appName || "PDF解析アプリ",
      runId: request?.runId || `RUN_${Date.now()}`,
      execTime: execTimeStr,
      summary: { total: 0, bizPass: 0, bizWarning: 0, bizFail: 0, bizSystemError: 0, metaPass: 0, metaFail: 0 },
      testResults: [],
      errors: ["無効なリクエスト構造です。testCases配列が必要です。"],
    };
  }

  const summary: CommonValidationSummary = {
    total: request.testCases.length,
    bizPass: 0,
    bizWarning: 0,
    bizFail: 0,
    bizSystemError: 0,
    metaPass: 0,
    metaFail: 0,
  };

  const testResults: CommonValidationTestResultItem[] = [];

  request.testCases.forEach((tc) => {
    const expectedBiz: CommonBusinessStatus = tc.expectedBusinessStatus || "PASS";
    const mismatchLevel = tc.mismatchLevel || "FAIL";
    const checkType: CommonCheckType = tc.checkType;

    const cmpResult = compareValuesCore(checkType, tc.expectedValue, tc.actualValue);

    let actualBiz: CommonBusinessStatus = "FAIL";
    let systemError = false;

    if (!cmpResult || cmpResult.isSystemError) {
      actualBiz = "SYSTEM ERROR";
      systemError = true;
      summary.bizSystemError++;
    } else if (cmpResult.match) {
      actualBiz = "PASS";
      systemError = false;
      summary.bizPass++;
    } else {
      actualBiz = mismatchLevel === "WARNING" ? "WARNING" : "FAIL";
      systemError = false;
      if (actualBiz === "WARNING") summary.bizWarning++;
      else summary.bizFail++;
    }

    const metaStatus = expectedBiz === actualBiz ? "PASS" : "FAIL";
    if (metaStatus === "PASS") {
      summary.metaPass++;
    } else {
      summary.metaFail++;
    }

    testResults.push({
      testNo: tc.testNo,
      testName: tc.testName,
      targetName: tc.targetName,
      checkType: tc.checkType,
      expectedVal: tc.expectedValue,
      actualVal: tc.actualValue,
      expectedBiz,
      actualBiz,
      metaStatus,
      reasonShort: cmpResult ? cmpResult.reason : "比較実行エラー",
      mismatchLevel,
      systemError,
      checkedAt: execTimeStr,
    });
  });

  const overallSuccess = summary.bizFail === 0 && summary.bizSystemError === 0;

  return {
    success: true,
    overallSuccess,
    appId: request.appId || "APP_PDF_OCR",
    appName: request.appName || "PDF解析アプリ",
    runId: request.runId || `RUN_${Date.now()}`,
    execTime: execTimeStr,
    summary,
    testResults,
  };
}

interface CompareResult {
  match: boolean;
  reason: string;
  isSystemError?: boolean;
}

/**
 * 完成版エンジン (ValidationInterface.gs compareValues_) に定義された11種類の比較判定器
 */
function compareValuesCore(checkType: CommonCheckType, expected: unknown, actual: unknown): CompareResult {
  try {
    switch (checkType) {
      case "EQUALS": {
        const match = String(expected) === String(actual);
        return { match, reason: match ? "一致" : `不一致 (期待: ${expected}, 実績: ${actual})` };
      }
      case "NOT_EQUALS": {
        const match = String(expected) !== String(actual);
        return { match, reason: match ? "不一致（正常）" : `一致してしまいました (値: ${actual})` };
      }
      case "CONTAINS": {
        const match = String(actual).includes(String(expected));
        return { match, reason: match ? "包含一致" : `未包含 (期待部分: ${expected}, 実績: ${actual})` };
      }
      case "NOT_EMPTY": {
        const match = actual !== null && actual !== undefined && String(actual).trim() !== "";
        return { match, reason: match ? "非空欄確認" : "データが空欄です" };
      }
      case "GREATER_THAN": {
        const numExp = Number(expected);
        const numAct = Number(actual);
        const match = !isNaN(numExp) && !isNaN(numAct) && numAct > numExp;
        return { match, reason: match ? `より大きい (${numAct} > ${numExp})` : `条件未満 (${numAct} <= ${numExp})` };
      }
      case "LESS_THAN": {
        const numExp = Number(expected);
        const numAct = Number(actual);
        const match = !isNaN(numExp) && !isNaN(numAct) && numAct < numExp;
        return { match, reason: match ? `より小さい (${numAct} < ${numExp})` : `条件超過 (${numAct} >= ${numExp})` };
      }
      case "ARRAY_LENGTH": {
        const arr = Array.isArray(actual) ? actual : [];
        const numExp = Number(expected);
        const match = arr.length === numExp;
        return { match, reason: match ? `配列要素数一致 (${arr.length}件)` : `配列要素数不一致 (期待: ${numExp}件, 実績: ${arr.length}件)` };
      }
      case "IS_TRUE": {
        const match = actual === true || actual === "true" || actual === 1;
        return { match, reason: match ? "条件適合 (TRUE)" : "条件不適合 (FALSE)" };
      }
      case "IS_FALSE": {
        const match = actual === false || actual === "false" || actual === 0;
        return { match, reason: match ? "条件適合 (FALSE)" : "条件不適合 (TRUE)" };
      }
      case "REGEX_MATCH": {
        const reg = new RegExp(String(expected));
        const match = reg.test(String(actual));
        return { match, reason: match ? "正規表現マッチ" : "正規表現アンマッチ" };
      }
      default:
        return { match: false, reason: `未サポートの判定タイプ: ${checkType}`, isSystemError: true };
    }
  } catch (e) {
    return { match: false, reason: `判定実行例外: ${e instanceof Error ? e.message : String(e)}`, isSystemError: true };
  }
}

