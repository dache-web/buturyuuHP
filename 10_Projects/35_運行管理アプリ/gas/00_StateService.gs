/**
 * ============================================================================
 * 文書番号：SPEC-01 / GASステート・チェックポイント管理モジュール
 * ファイル名：00_StateService.gs
 * 役割：13_PROJECT_CURRENT_STATE, 14_PROJECT_CHECKPOINT, 15_PROJECT_DECISIONS
 * ============================================================================
 */

var StateService = (function() {
  /**
   * CURRENT_STATEの値を取得する
   */
  function getState(stateKey) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("13_PROJECT_CURRENT_STATE");
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === stateKey) {
        return data[i][1];
      }
    }
    return null;
  }

  /**
   * チェックポイント(14)を追記・取得する
   */
  function getCheckpoints() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("14_PROJECT_CHECKPOINT");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      result.push(row);
    }
    return result;
  }

  /**
   * 意思決定(15)を取得する
   */
  function getDecisions() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("15_PROJECT_DECISIONS");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      result.push(row);
    }
    return result;
  }

  return {
    getState: getState,
    getCheckpoints: getCheckpoints,
    getDecisions: getDecisions
  };
})();
