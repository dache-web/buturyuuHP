/**
 * セットアップ・初期化処理
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nowStr = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy/MM/dd HH:mm:ss");
  
  let createdSheetsCount = 0;
  let existingSheetsCount = 0;
  let initialDataCount = 0;
  let warnings = 0;
  let errors = 0;
  
  console.log("【初期セットアップ開始】");

  try {
    for (const key in CONFIG.SHEET_NAMES) {
      const sheetName = CONFIG.SHEET_NAMES[key];
      const isNew = ss.getSheetByName(sheetName) === null;
      
      // シート作成または取得
      const sheet = SheetService.getOrCreateSheet(ss, sheetName);
      
      if (isNew) {
        createdSheetsCount++;
        console.log(`シート作成: ${sheetName}`);
      } else {
        existingSheetsCount++;
      }
      
      // ヘッダーの設定（空の場合のみ）
      const headers = CONFIG.HEADERS[sheetName] || [];
      const a1Value = sheet.getRange("A1").getValue();
      if (a1Value === "") {
        SheetService.setHeaders(sheet, headers);
        console.log(`ヘッダー設定: ${sheetName}`);
        
        // ヘッダーを新設した場合、表示形式も設定する
        SheetService.setColumnFormats(sheet, headers);
      } else if (a1Value !== headers[0]) {
        console.warn(`[警告] ヘッダー不一致: ${sheetName} (A1: ${a1Value} != ${headers[0]})`);
        warnings++;
      }
      
      // プルダウン・チェックボックスの設定（データ開始行以降に適用）
      SheetService.setValidationRules(sheet, headers);
      SheetService.setCheckboxes(sheet, headers, CONFIG.CHECKBOX_COLUMNS[sheetName]);
      
      // 初期データの設定
      // 設定シート
      if (sheetName === CONFIG.SHEET_NAMES.SETTINGS) {
        const a2Value = sheet.getRange(2, 1).getValue();
        if (a2Value === "") {
          SheetService.setInitialData(sheet, CONFIG.INITIAL_DATA.SETTINGS);
          initialDataCount += CONFIG.INITIAL_DATA.SETTINGS.length;
          console.log("初期データ登録: 設定");
        }
      }
      // 路線便会社マスタ
      else if (sheetName === CONFIG.SHEET_NAMES.CARRIER) {
        const a2Value = sheet.getRange(2, 1).getValue();
        if (a2Value === "") {
          const initialCarriers = CONFIG.INITIAL_DATA.CARRIERS.map(c => {
            const id = IdService.generateId(CONFIG.ID_PREFIX[sheetName]);
            return [id, c[0], c[1], c[2], c[3], c[4], nowStr, nowStr];
          });
          SheetService.setInitialData(sheet, initialCarriers);
          initialDataCount += initialCarriers.length;
          console.log("初期データ登録: 路線便会社マスタ (4社)");
        }
      }
      // 項目名称辞書
      else if (sheetName === CONFIG.SHEET_NAMES.DICTIONARY) {
        const a2Value = sheet.getRange(2, 1).getValue();
        if (a2Value === "") {
          const initialDict = CONFIG.INITIAL_DATA.DICTIONARY.map(d => {
            const id = IdService.generateId(CONFIG.ID_PREFIX[sheetName]);
            // ["辞書ID", "共通項目名", "表記候補", "対象路線便会社コード", "対象路線便会社名", "一致方法", "優先順位", "有効フラグ", "備考", "登録日時", "更新日時"]
            return [id, d[0], d[1], "", "", "完全一致", "1", true, "初期登録辞書", nowStr, nowStr];
          });
          SheetService.setInitialData(sheet, initialDict);
          initialDataCount += initialDict.length;
          console.log("初期データ登録: 項目名称辞書");
        }
      }
    }
    
    console.log("【初期セットアップ完了】");
    
    // ダイアログ表示
    const ui = SpreadsheetApp.getUi();
    const resultMsg = `初期セットアップが完了しました。\\n\\n` +
                      `作成シート数：${createdSheetsCount}\\n` +
                      `既存シート数：${existingSheetsCount}\\n` +
                      `初期登録件数：${initialDataCount}\\n` +
                      `警告件数：${warnings}\\n` +
                      `エラー件数：${errors}\\n\\n` +
                      `次の作業：\\n路線便会社Aの実ファイルを確認し、項目マッピングを作成してください。`;
    ui.alert("セットアップ完了", resultMsg, ui.ButtonSet.OK);
    
  } catch (e) {
    console.error("セットアップ中にエラーが発生しました: " + e.message);
    errors++;
    const ui = SpreadsheetApp.getUi();
  }
}

function getImportRealValues() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = ss.getSheetByName(CONFIG.SHEET_NAMES.HISTORY);
  const tempSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TEMP_DATA);
  const analysisSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ANALYSIS_DATA);

  let importId = "未実施/なし";
  let targetCount = 0;
  let newCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  if (historySheet && historySheet.getLastRow() > 1) {
    const hData = historySheet.getDataRange().getValues();
    const hHeaders = hData[0];
    const lastRow = hData[hData.length - 1];
    
    const getHVal = (colName) => {
      const idx = hHeaders.indexOf(colName);
      return idx > -1 ? lastRow[idx] : "";
    };

    importId = getHVal("取込ID") || "なし";
    targetCount = Number(getHVal("読込件数") || getHVal("読込予定件数") || 0);
    newCount = Number(getHVal("登録件数") || 0);
    duplicateCount = Number(getHVal("重複件数") || 0);
    errorCount = Number(getHVal("エラー件数") || 0);
  }

  let tempCount = 0;
  if (tempSheet && tempSheet.getLastRow() > 1 && importId !== "未実施/なし") {
    const tData = tempSheet.getDataRange().getValues();
    for (let i = 1; i < tData.length; i++) {
      if (tData[i][1] === importId) tempCount++;
    }
  }

  const resultObj = {
    importId: importId,
    tempDataCount: tempCount,
    targetCount: targetCount,
    newCount: newCount,
    duplicateCount: duplicateCount,
    errorCount: errorCount
  };

  console.log("【実機データ計測結果】", JSON.stringify(resultObj));
  return resultObj;
}
