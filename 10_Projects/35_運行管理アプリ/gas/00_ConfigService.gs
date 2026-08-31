/**
 * ============================================================================
 * 文書番号：SPEC-01 / GAS構成サービスモジュール
 * ファイル名：00_ConfigService.gs
 * 役割：第0工程 スプレッドシート管理基盤の読み込み・項目定義・操作区分・ルール管理
 * ============================================================================
 */

var ConfigService = (function() {
  /**
   * システム設定(SYS_CONFIG)を取得する
   * @param {string} key 設定キー (例: 'SCHEMA_VERSION')
   * @return {string} 設定値
   */
  function getConfig(key) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("00_システム設定");
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        return data[i][1];
      }
    }
    return null;
  }

  /**
   * 01_シート管理台帳(SYS_SHEETS)から全シートの情報を取得する
   * @return {Array<Object>} シート情報の配列
   */
  function getSheetRegistry() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("01_シート管理台帳");
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
   * 02_項目定義台帳(SYS_FIELDS)から対象シートのカラム定義を取得する
   * @param {string} targetSheetKey 対象シートのKey (例: 'T_DISPATCH')
   * @return {Array<Object>} 項目定義の配列
   */
  function getFieldDefinitions(targetSheetKey) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("02_項目定義台帳");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
      if (!targetSheetKey || data[i][0] === targetSheetKey) {
        var row = {};
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = data[i][j];
        }
        result.push(row);
      }
    }
    return result;
  }

  /**
   * 05_選択肢マスタ(M_OPTIONS)から特定グループの選択肢を取得する
   * @param {string} optionGroup グループキー (例: 'DISPATCH_STATUS')
   * @return {Array<Object>} 選択肢の配列
   */
  function getOptions(optionGroup) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("05_選択肢マスタ");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === optionGroup && data[i][4] === true) {
        result.push({
          value: data[i][1],
          label: data[i][2],
          sortOrder: data[i][3],
          badgeColor: data[i][5]
        });
      }
    }
    result.sort(function(a, b) { return a.sortOrder - b.sortOrder; });
    return result;
  }

  /**
   * 06_ルールマスタ(M_RULES)からルールを取得する
   * @param {string} ruleKey ルールキー
   * @return {Object|null} ルールオブジェクト
   */
  function getRule(ruleKey) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("06_ルールマスタ");
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === ruleKey && data[i][4] === true) {
        return {
          ruleKey: data[i][0],
          ruleName: data[i][1],
          ruleValue: data[i][2],
          warningMessage: data[i][3],
          isActive: data[i][4]
        };
      }
    }
    return null;
  }

  return {
    getConfig: getConfig,
    getSheetRegistry: getSheetRegistry,
    getFieldDefinitions: getFieldDefinitions,
    getOptions: getOptions,
    getRule: getRule
  };
})();
