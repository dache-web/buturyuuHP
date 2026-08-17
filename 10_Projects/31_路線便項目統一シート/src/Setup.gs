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
    ui.alert("セットアップエラー", "処理中にエラーが発生しました。ログを確認してください。\\n" + e.message, ui.ButtonSet.OK);
  }
}
