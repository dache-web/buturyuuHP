/**
 * TempManager.gs
 * 一時ファイル、一時シート、解析用トークンなどの管理を行うモジュール
 */

const TempManager = {
  // 一時シートのプレフィックス
  SHEET_PREFIX_PARSE: 'temp_parse_',
  
  // システム設定シート名
  SETTING_SHEET_NAME: '00_システム設定',

  /**
   * システム設定から一時ファイル関連の設定を取得する
   */
  getSettings: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(this.SETTING_SHEET_NAME);
    if (!sheet) return { tempFolderId: '', retentionDays: 1, lastCleanup: '' };
    
    // B列が項目名、C列が値
    const data = sheet.getDataRange().getValues();
    const settings = { tempFolderId: '', retentionDays: 1, lastCleanup: '' };
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][1] === '一時ファイル保存先フォルダID') settings.tempFolderId = data[i][2];
      if (data[i][1] === '一時ファイル保持期限(日)') settings.retentionDays = parseFloat(data[i][2]) || 1;
      if (data[i][1] === '最終清掃日時') settings.lastCleanup = data[i][2];
    }
    return settings;
  },

  /**
   * 最終清掃日時を更新する
   */
  updateLastCleanup: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(this.SETTING_SHEET_NAME);
    if (!sheet) return;
    
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][1] === '最終清掃日時') {
        sheet.getRange(i + 1, 3).setValue(new Date());
        break;
      }
    }
  },

  /**
   * 解析結果を保存するための一時シートを作成・書き込み
   * @param {string} processId 解析処理ID
   * @param {Object} metadata メタデータオブジェクト
   * @param {Array<Array>} headers 標準化データのヘッダー行
   * @param {Array<Array>} data パース済みデータの2次元配列
   */
  saveParseResult: function(processId, metadata, headers, data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = this.SHEET_PREFIX_PARSE + processId;
    let sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      ss.deleteSheet(sheet);
    }
    sheet = ss.insertSheet(sheetName);
    sheet.hideSheet();

    // 1行目: システム管理用メタデータの項目名
    const metaKeys = Object.keys(metadata);
    sheet.getRange(1, 1, 1, metaKeys.length).setValues([metaKeys]);
    
    // 2行目: システム管理用メタデータの値
    const metaValues = metaKeys.map(k => metadata[k]);
    sheet.getRange(2, 1, 1, metaValues.length).setValues([metaValues]);

    // 3行目: 標準化データのヘッダー
    if (headers && headers.length > 0) {
      sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
    }

    // 4行目以降: パース済みデータ
    if (data && data.length > 0) {
      sheet.getRange(4, 1, data.length, data[0].length).setValues(data);
    }
  },

  /**
   * 保存された一時シートの情報を読み取る
   */
  getParseResult: function(processId) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = this.SHEET_PREFIX_PARSE + processId;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return null;

    const fullData = sheet.getDataRange().getValues();
    if (fullData.length < 3) return null;

    const metaKeys = fullData[0];
    const metaVals = fullData[1];
    const metadata = {};
    for (let i = 0; i < metaKeys.length; i++) {
      metadata[metaKeys[i]] = metaVals[i];
    }

    const headers = fullData[2];
    const data = fullData.slice(3);

    return {
      metadata: metadata,
      headers: headers,
      data: data
    };
  },

  /**
   * 一時シートを削除する
   */
  deleteParseResult: function(processId) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = this.SHEET_PREFIX_PARSE + processId;
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      ss.deleteSheet(sheet);
    }
  },

  /**
   * 古い一時ファイル・シートを削除する定期処理
   */
  cleanupOldFiles: function() {
    const settings = this.getSettings();
    if (!settings.tempFolderId) return;

    const retentionMs = settings.retentionDays * 24 * 60 * 60 * 1000;
    const thresholdDate = new Date(new Date().getTime() - retentionMs);

    // Driveファイル清掃
    try {
      const folder = DriveApp.getFolderById(settings.tempFolderId);
      const files = folder.searchFiles("title contains 'temp_import_'");
      while (files.hasNext()) {
        const file = files.next();
        if (file.getDateCreated() < thresholdDate) {
          file.setTrashed(true);
        }
      }
    } catch (e) {
      console.error("Temp file cleanup failed: " + e.message);
    }

    // 一時シート清掃
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    for (const sheet of sheets) {
      const name = sheet.getName();
      if (name.startsWith(this.SHEET_PREFIX_PARSE)) {
        try {
          const metaVal = sheet.getRange("A2:Z2").getValues()[0];
          const metaKeys = sheet.getRange("A1:Z1").getValues()[0];
          let dateIndex = metaKeys.indexOf('解析日時');
          if (dateIndex !== -1 && metaVal[dateIndex]) {
            const parseDate = new Date(metaVal[dateIndex]);
            if (parseDate < thresholdDate) {
              ss.deleteSheet(sheet);
            }
          }
        } catch (e) {
          // メタデータ読取エラー時はスキップ
        }
      }
    }

    this.updateLastCleanup();
  }
};
