/**
 * ログ記録・トラッキング用サービス
 */
const LogService = (() => {

  // スプレッドシートのヘッダーがConstantsの定義と一致しているか確認し、不足分を右端へ追加する
  function ensureLogHeaders(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const requiredHeaders = CONFIG.HEADERS[sheetName];
    if (!requiredHeaders) return;

    const lastCol = sheet.getLastColumn();
    let currentHeaders = [];
    if (lastCol > 0) {
      currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }

    const missingHeaders = [];
    requiredHeaders.forEach(h => {
      if (!currentHeaders.includes(h)) {
        missingHeaders.push(h);
      }
    });

    if (missingHeaders.length > 0) {
      const startCol = lastCol + 1;
      sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
      sheet.getRange(1, startCol, 1, missingHeaders.length).setBackground("#f3f4f6").setFontWeight("bold");
    }
  }

  /**
   * 処理開始時に最初のログを作成する
   * @param {Object} params 
   * @returns {Object} 処理ID等を含む結果
   */
  function startProcess(params) {
    const { operationType, companyCode, companyName, formatName, fileName, fileFormat, fileSize, plannedCount } = params;
    
    // ヘッダーの同期
    ensureLogHeaders(CONFIG.SHEET_NAMES.HISTORY);
    ensureLogHeaders(CONFIG.SHEET_NAMES.ERROR_LOG);
    ensureLogHeaders(CONFIG.SHEET_NAMES.PROCESS_LOG);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.HISTORY);
    if (!sheet) {
      return { success: false, message: "10_取込履歴シートが見つかりません。" };
    }

    const processId = IdService.generateId("PROC");
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    const user = Session.getActiveUser().getEmail();

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = new Array(headers.length).fill("");

    // 初期値セット
    const setVal = (colName, val) => {
      const idx = headers.indexOf(colName);
      if (idx !== -1) rowData[idx] = val;
    };

    setVal("取込ID", processId); // 互換性のため
    setVal("処理ID", processId);
    setVal("操作種類", operationType || "");
    setVal("路線便会社コード", companyCode || "");
    setVal("路線便会社名", companyName || "");
    setVal("フォーマット名", formatName || "");
    setVal("元ファイル名", fileName || "");
    setVal("ファイルサイズ", fileSize || "");
    setVal("ファイル形式", fileFormat || "");
    setVal("読込予定件数", plannedCount || 0);
    setVal("現在の処理工程", "取込開始");
    setVal("処理状態", "開始");
    setVal("最終メッセージ", "処理を開始しました");
    setVal("実行ユーザー", user);
    setVal("開始日時", nowStr);
    setVal("取込日時", nowStr);

    sheet.appendRow(rowData);

    // 実際に保存されたか再取得して確認
    const lastRow = sheet.getLastRow();
    const savedId = sheet.getRange(lastRow, headers.indexOf("処理ID") + 1).getValue();
    
    if (savedId !== processId && sheet.getRange(lastRow, headers.indexOf("取込ID") + 1).getValue() !== processId) {
      return { success: false, message: "10_取込履歴への開始記録の書き込みに失敗しました。" };
    }

    return {
      success: true,
      processId: processId,
      message: "開始記録を作成しました。"
    };
  }

  /**
   * 処理IDを指定して進捗を更新する
   */
  function updateProcess(processId, updates) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.HISTORY);
    if (!sheet) return false;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColIdx1 = headers.indexOf("処理ID");
    const idColIdx2 = headers.indexOf("取込ID");

    let targetRowIdx = -1;
    // 後ろから探す（最新のものを優先）
    for (let r = data.length - 1; r > 0; r--) {
      if ((idColIdx1 !== -1 && data[r][idColIdx1] === processId) || 
          (idColIdx2 !== -1 && data[r][idColIdx2] === processId)) {
        targetRowIdx = r;
        break;
      }
    }

    if (targetRowIdx === -1) return false;

    Object.keys(updates).forEach(key => {
      const cIdx = headers.indexOf(key);
      if (cIdx !== -1) {
        sheet.getRange(targetRowIdx + 1, cIdx + 1).setValue(updates[key]);
      }
    });

    return true;
  }

  /**
   * エラーログを書き込む
   */
  function writeError(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ERROR_LOG);
    if (!sheet) return;

    const errorId = IdService.generateId("ERR");
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = new Array(headers.length).fill("");

    const setVal = (colName, val) => {
      const idx = headers.indexOf(colName);
      if (idx !== -1) rowData[idx] = val;
    };

    setVal("エラーID", errorId);
    setVal("発生日時", nowStr);
    setVal("処理ID", params.processId || "");
    setVal("処理工程", params.stage || "");
    setVal("処理名", params.stage || "");
    setVal("路線便会社コード", params.companyCode || "");
    setVal("路線便会社名", params.companyName || "");
    setVal("フォーマット名", params.formatName || "");
    setVal("元ファイル名", params.fileName || "");
    setVal("元シート名", params.sheetName || "");
    setVal("元行番号", params.rowNumber || "");
    setVal("原本項目名", params.originalField || "");
    setVal("標準役割", params.standardRole || "");
    setVal("元の値", params.originalValue || "");
    setVal("エラー内容", params.message || "");
    setVal("技術エラー内容", params.technicalDetails || "");
    setVal("対象関数名", params.functionName || "");
    setVal("対応状況", "未対応");

    sheet.appendRow(rowData);
  }

  /**
   * 各工程ごとのログを「24_処理工程ログ」へ1行ずつ記録する
   */
  function writeProcessLog(params) {
    const { processId, stepNumber, stage, action, status, fileName, companyName, formatName, expectedCount, processedCount, successCount, errorCount, functionName, side, message, technicalDetails } = params;
    
    ensureLogHeaders(CONFIG.SHEET_NAMES.PROCESS_LOG);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PROCESS_LOG);
    if (!sheet) return;

    const logId = IdService.generateId("PRL");
    const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = new Array(headers.length).fill("");

    const setVal = (colName, val) => {
      const idx = headers.indexOf(colName);
      if (idx !== -1) rowData[idx] = val;
    };

    setVal("工程ログID", logId);
    setVal("処理ID", processId || "");
    setVal("記録日時", nowStr);
    setVal("工程番号", stepNumber || "");
    setVal("処理工程", stage || "");
    setVal("処理内容", action || "");
    setVal("処理結果", status || "");
    setVal("対象ファイル", fileName || "");
    setVal("対象会社", companyName || "");
    setVal("対象フォーマット", formatName || "");
    setVal("予定件数", expectedCount === undefined ? "" : expectedCount);
    setVal("処理件数", processedCount === undefined ? "" : processedCount);
    setVal("成功件数", successCount === undefined ? "" : successCount);
    setVal("エラー件数", errorCount === undefined ? "" : errorCount);
    setVal("対象関数名", functionName || "");
    setVal("画面側またはGAS側", side || "GAS側");
    setVal("メッセージ", message || "");
    setVal("技術情報", technicalDetails || "");

    sheet.appendRow(rowData);
  }

  return {
    startProcess,
    updateProcess,
    writeError,
    writeProcessLog
  };
})();
