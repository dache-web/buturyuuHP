/**
 * ============================================================================
 * 文書番号：SPEC-01 / GASログサービスモジュール
 * ファイル名：00_LogService.gs
 * 役割：エラーログ(09), アプリログ(10), データ変更履歴(11), スキーマ履歴(12) 追記処理
 * ============================================================================
 */

var LogService = (function() {
  /**
   * 09_エラーログ (LOG_ERROR) に永久ログを出力する
   */
  function logError(featureKey, user, sheetKey, targetId, errorMessage, stackTrace) {
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("09_エラーログ");
      if (!sheet) return;
      var logId = "ERR-" + Utilities.formatDate(new Date(), "JST", "yyyyMMddHHmmssSSS");
      var now = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm:ss");
      sheet.appendRow([logId, now, featureKey || "", user || "SYSTEM", sheetKey || "", targetId || "", errorMessage || "", stackTrace || "", "未対応"]);
    } catch(e) {
      Logger.log("エラーログ出力失敗: " + e.toString());
    }
  }

  /**
   * 10_アプリログ (LOG_APP) に操作ログを出力する
   */
  function logApp(user, action, targetId, detailsObj) {
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("10_アプリログ");
      if (!sheet) return;
      var logId = "LOG-" + Utilities.formatDate(new Date(), "JST", "yyyyMMddHHmmssSSS");
      var now = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm:ss");
      var detailsJson = detailsObj ? JSON.stringify(detailsObj) : "";
      sheet.appendRow([logId, now, user || "UNKNOWN", action, targetId || "", detailsJson]);
    } catch(e) {
      Logger.log("アプリログ出力失敗: " + e.toString());
    }
  }

  /**
   * 11_データ変更履歴 (LOG_HISTORY) に変更前後の差分を出力する
   */
  function logHistory(user, sheetKey, targetId, beforeObj, afterObj) {
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("11_データ変更履歴");
      if (!sheet) return;
      var historyId = "HIS-" + Utilities.formatDate(new Date(), "JST", "yyyyMMddHHmmssSSS");
      var now = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm:ss");
      var beforeJson = beforeObj ? JSON.stringify(beforeObj) : "";
      var afterJson = afterObj ? JSON.stringify(afterObj) : "";
      sheet.appendRow([historyId, now, user || "UNKNOWN", sheetKey, targetId, beforeJson, afterJson]);
    } catch(e) {
      Logger.log("データ変更履歴出力失敗: " + e.toString());
    }
  }

  /**
   * 12_スキーマ変更履歴 (LOG_SCHEMA) に構造変更を出力する
   */
  function logSchemaChange(changeType, targetKey, beforeSchema, afterSchema, reason) {
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("12_スキーマ変更履歴");
      if (!sheet) return;
      var schemaLogId = "SCH-" + Utilities.formatDate(new Date(), "JST", "yyyyMMddHHmmssSSS");
      var now = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm:ss");
      sheet.appendRow([schemaLogId, now, changeType, targetKey, beforeSchema || "-", afterSchema, reason]);
    } catch(e) {
      Logger.log("スキーマ変更履歴出力失敗: " + e.toString());
    }
  }

  return {
    logError: logError,
    logApp: logApp,
    logHistory: logHistory,
    logSchemaChange: logSchemaChange
  };
})();
