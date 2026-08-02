/**
 * PDFデータ変換_管理 スプレッドシート用 GASスクリプト
 * 
 * =========================================
 * 1. Config.gs 相当
 * =========================================
 */

const SHEET_NAMES = {
  SETTINGS: "01_基本設定",
  RULES: "02_ルールマスタ",
  FIELDS: "03_項目マスタ",
  OUTPUT_SETTINGS: "04_出力先設定",
  EXTRACTION_HISTORY: "05_抽出履歴",
  IMPORT_HISTORY: "06_取込履歴",
  OUTPUT_DATA: "07_出力データ",
  CHOICES: "08_選択肢マスタ",
  TEST_RESULTS: "09_テスト結果"
};

/**
 * =========================================
 * 2. Setup.gs 相当
 * =========================================
 */

function rebuildPdfDataConversionSpreadsheet() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('完全再作成の確認', 'すべてのデータが消去されます。対象の9シートを削除して再作成しますか？', ui.ButtonSet.YES_NO);
  if (response === ui.Button.YES) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.values(SHEET_NAMES).forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        ss.deleteSheet(sheet);
      }
    });
    setupPdfDataConversionSpreadsheet();
    ui.alert('完全再作成が完了しました。');
  }
}

function setupPdfDataConversionSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. シート作成とヘッダー設定
  setupSheet(ss, SHEET_NAMES.SETTINGS, ["設定キー", "設定値", "説明", "有効", "更新日時"]);
  setupSheet(ss, SHEET_NAMES.RULES, ["ルールID", "ルール名", "ルール分類", "用途", "出力方式", "出力ID", "有効", "表示順", "作成日時", "更新日時"]);
  setupSheet(ss, SHEET_NAMES.FIELDS, ["項目ID", "ルールID", "項目名", "項目説明", "選択方法", "抽出単位", "複数選択", "結合方法", "データ型", "必須", "出力列名", "表示順", "有効", "作成日時", "更新日時"]);
  setupSheet(ss, SHEET_NAMES.OUTPUT_SETTINGS, ["出力ID", "ルールID", "出力先スプレッドシートID", "出力先シート名", "出力方式", "ヘッダー行", "開始列", "ファイル名を出力", "取込日時を出力", "ページ番号を出力", "上書き可否", "有効", "作成日時", "更新日時"]);
  setupSheet(ss, SHEET_NAMES.EXTRACTION_HISTORY, ["抽出ID", "取込ID", "ルールID", "項目ID", "項目名", "ページ番号", "選択方法", "元文字", "修正後文字", "確定文字", "X", "Y", "幅", "高さ", "選択要素ID", "作成日時", "作成者"]);
  setupSheet(ss, SHEET_NAMES.IMPORT_HISTORY, ["取込ID", "ファイル名", "ファイルサイズ", "ページ数", "取込日時", "解析開始日時", "解析完了日時", "解析状態", "取得文字数", "取得要素数", "文字取得可能ページ数", "文字取得不可ページ数", "選択ルールID", "出力状態", "エラー内容"]);
  setupSheet(ss, SHEET_NAMES.OUTPUT_DATA, ["取込ID", "出力日時", "ファイル名", "ルールID", "ルール名", "ページ番号", "項目ID", "項目名", "元文字", "確定文字"]);
  setupSheet(ss, SHEET_NAMES.CHOICES, ["選択肢種別", "値", "表示名", "表示順", "有効"]);
  setupSheet(ss, SHEET_NAMES.TEST_RESULTS, ["テストID", "テスト名", "実行日時", "結果", "期待値", "実測値", "エラー内容"]);

  // 不要なデフォルトシート削除
  const defaultSheet = ss.getSheetByName("シート1");
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // 2. 初期データ登録
  registerInitialSettings(ss);
  registerInitialChoices(ss);
  registerInitialRules(ss);
  registerInitialFields(ss);
  registerInitialOutputSettings(ss);

  // 3. 書式設定と入力規則
  applyFormattingAndValidations(ss);
}

function setupSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // ヘッダーが不足している場合は補完 (今回は1行目に上書き)
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

/**
 * =========================================
 * 3. MasterData.gs 相当
 * =========================================
 */

function getExistingKeys(sheet, keyColumnIndex) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  const values = sheet.getRange(2, keyColumnIndex, lastRow - 1, 1).getValues();
  return new Set(values.map(row => row[0]));
}

function getExistingChoices(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  // 選択肢種別(1列目) ＋ 値(2列目) で判定
  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  return new Set(values.map(row => row[0] + "_" + row[1]));
}

function appendMissingData(sheet, data, existingKeys, keyFunc) {
  const toAppend = data.filter(row => !existingKeys.has(keyFunc(row)));
  if (toAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
  }
}

function registerInitialSettings(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  const existing = getExistingKeys(sheet, 1); // 設定キーは1列目
  const now = new Date();
  
  const initialData = [
    ["APP_NAME", "PDFデータ変換", "アプリ名", true, now],
    ["FULL_TEXT_EXTRACTION", true, "PDF取込時に全ページの取得可能文字を必ず解析する", true, now],
    ["DEFAULT_RULE_ID", "RULE-FREE-001", "初期選択ルール", true, now],
    ["OUTPUT_MODE", "spreadsheet", "正式な出力先", true, now],
    ["OCR_ENABLED", false, "OCRは現在使用しない", true, now],
    ["SCHEMA_VERSION", "1.0", "管理スプレッドシートの構造バージョン", true, now]
  ];
  
  appendMissingData(sheet, initialData, existing, row => row[0]);
}

function registerInitialRules(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.RULES);
  const existing = getExistingKeys(sheet, 1); // ルールIDは1列目
  const now = new Date();

  const initialData = [
    ["RULE-FREE-001", "自由抽出", "free", "PDF全体の解析結果から必要部分を自由に選択する", "document_row", "OUTPUT-FREE-001", true, 1, now, now],
    ["RULE-PAGE-001", "ページ単位抽出", "page", "選択したページ単位でデータ化する", "page_rows", "OUTPUT-PAGE-001", true, 2, now, now],
    ["RULE-BLOCK-001", "範囲・ブロック抽出", "block", "文字枠またはドラッグ範囲をまとまりとして抽出する", "block_rows", "OUTPUT-BLOCK-001", true, 3, now, now],
    ["RULE-DOCUMENT-001", "文書全文抽出", "document", "PDF全文を1つのデータとして出力する", "document_row", "OUTPUT-DOCUMENT-001", true, 4, now, now],
    ["RULE-TEMPLATE-001", "定型フォーマット抽出", "template", "将来、同じ帳票へ保存済み抽出ルールを適用する", "document_row", "OUTPUT-TEMPLATE-001", false, 5, now, now]
  ];

  appendMissingData(sheet, initialData, existing, row => row[0]);
}

function registerInitialFields(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.FIELDS);
  const existing = getExistingKeys(sheet, 1); // 項目IDは1列目
  const now = new Date();

  const initialData = [
    ["ITEM-FREE-001", "RULE-FREE-001", "抽出項目1", "自由に指定する抽出項目", "click_or_drag", "block", true, "newline", "multiline", false, "抽出項目1", 1, true, now, now],
    ["ITEM-FREE-002", "RULE-FREE-001", "抽出項目2", "自由に指定する抽出項目", "click_or_drag", "block", true, "newline", "multiline", false, "抽出項目2", 2, true, now, now],
    ["ITEM-FREE-003", "RULE-FREE-001", "抽出項目3", "自由に指定する抽出項目", "click_or_drag", "block", true, "newline", "multiline", false, "抽出項目3", 3, true, now, now],
    ["ITEM-PAGE-001", "RULE-PAGE-001", "ページ内容", "選択したページの全文", "page", "page", false, "newline", "multiline", true, "ページ内容", 1, true, now, now],
    ["ITEM-BLOCK-001", "RULE-BLOCK-001", "抽出ブロック", "選択した範囲または文字のまとまり", "click_or_drag", "block", true, "newline", "multiline", true, "抽出ブロック", 1, true, now, now],
    ["ITEM-DOCUMENT-001", "RULE-DOCUMENT-001", "文書全文", "PDF全体の全文", "document", "document", false, "newline", "multiline", true, "文書全文", 1, true, now, now]
  ];

  appendMissingData(sheet, initialData, existing, row => row[0]);
}

function registerInitialOutputSettings(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.OUTPUT_SETTINGS);
  const existing = getExistingKeys(sheet, 1); // 出力IDは1列目
  const now = new Date();
  const ssId = ss.getId();

  const initialData = [
    ["OUTPUT-FREE-001", "RULE-FREE-001", ssId, "07_出力データ", "document_row", 1, "A", true, true, true, false, true, now, now],
    ["OUTPUT-PAGE-001", "RULE-PAGE-001", ssId, "07_出力データ", "page_rows", 1, "A", true, true, true, false, true, now, now],
    ["OUTPUT-BLOCK-001", "RULE-BLOCK-001", ssId, "07_出力データ", "block_rows", 1, "A", true, true, true, false, true, now, now],
    ["OUTPUT-DOCUMENT-001", "RULE-DOCUMENT-001", ssId, "07_出力データ", "document_row", 1, "A", true, true, false, false, true, now, now],
    ["OUTPUT-TEMPLATE-001", "RULE-TEMPLATE-001", ssId, "07_出力データ", "document_row", 1, "A", true, true, true, false, false, now, now]
  ];

  appendMissingData(sheet, initialData, existing, row => row[0]);
}

function registerInitialChoices(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.CHOICES);
  const existing = getExistingChoices(sheet);

  const initialData = [
    ["selection_method", "click", "文字枠クリック", 1, true],
    ["selection_method", "multi_click", "複数文字クリック", 2, true],
    ["selection_method", "rectangle", "ドラッグ範囲", 3, true],
    ["selection_method", "click_or_drag", "文字クリックまたは範囲選択", 4, true],
    ["selection_method", "page", "現在ページ", 5, true],
    ["selection_method", "multi_page", "複数ページ", 6, true],
    ["selection_method", "document", "文書全文", 7, true],
    
    ["join_method", "none", "そのまま", 1, true],
    ["join_method", "no_space", "空白なし", 2, true],
    ["join_method", "space", "半角スペース", 3, true],
    ["join_method", "full_space", "全角スペース", 4, true],
    ["join_method", "newline", "改行", 5, true],
    ["join_method", "comma", "カンマ", 6, true],
    
    ["data_type", "text", "文字列", 1, true],
    ["data_type", "multiline", "複数行", 2, true],
    ["data_type", "integer", "整数", 3, true],
    ["data_type", "decimal", "小数", 4, true],
    ["data_type", "currency", "金額", 5, true],
    ["data_type", "date", "日付", 6, true],
    ["data_type", "time", "時刻", 7, true],
    
    ["output_mode", "document_row", "1PDFにつき1行", 1, true],
    ["output_mode", "page_rows", "1ページにつき1行", 2, true],
    ["output_mode", "block_rows", "1ブロックにつき1行", 3, true],
    ["output_mode", "detail_rows", "明細ごとに複数行", 4, true]
  ];

  appendMissingData(sheet, initialData, existing, row => row[0] + "_" + row[1]);
}

/**
 * =========================================
 * 4. Validation.gs 相当
 * =========================================
 */

function applyFormattingAndValidations(ss) {
  Object.values(SHEET_NAMES).forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const maxCol = sheet.getMaxColumns();
    const lastRow = Math.max(sheet.getLastRow(), 2);
    
    // 1行目を固定
    sheet.setFrozenRows(1);
    
    // ヘッダーを太字、背景色設定
    const headerRange = sheet.getRange(1, 1, 1, maxCol);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#f3f3f3");
    
    // フィルターを設定
    if (sheet.getFilter() === null) {
      sheet.getRange(1, 1, lastRow, maxCol).createFilter();
    }
    
    // 列幅を自動調整 (実行が重いため今回は除外か最小限とする)
    // sheet.autoResizeColumns(1, maxCol); 
    
    // データ行を上揃え、長文折り返し
    const dataRange = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), maxCol);
    dataRange.setVerticalAlignment("top");
    dataRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    
    // TRUE/FALSE列のチェックボックス化
    const headers = headerRange.getValues()[0];
    headers.forEach((header, index) => {
      if (header === "有効" || header === "必須" || header === "複数選択" || header === "上書き可否" || header === "ファイル名を出力" || header === "取込日時を出力" || header === "ページ番号を出力") {
        sheet.getRange(2, index + 1, sheet.getMaxRows() - 1, 1).insertCheckboxes();
      }
    });
  });

  // 選択肢マスタからのデータ入力規則の設定
  setupDataValidations(ss);
}

function setupDataValidations(ss) {
  const choicesSheet = ss.getSheetByName(SHEET_NAMES.CHOICES);
  const choicesData = choicesSheet.getDataRange().getValues();
  
  const getChoicesByType = (type) => choicesData.filter(r => r[0] === type && r[4] === true).map(r => r[1]);

  const selMethods = getChoicesByType("selection_method");
  const joinMethods = getChoicesByType("join_method");
  const dataTypes = getChoicesByType("data_type");
  const outputModes = getChoicesByType("output_mode");

  const buildValidation = (list) => {
    if (list.length === 0) return null;
    return SpreadsheetApp.newDataValidation().requireValueInList(list).setAllowInvalid(false).build();
  };

  const applyRule = (sheetName, headerName, validationList) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIdx = headers.indexOf(headerName);
    if (colIdx >= 0) {
      const rule = buildValidation(validationList);
      if (rule) {
        sheet.getRange(2, colIdx + 1, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
      }
    }
  };

  // 03_項目マスタ
  applyRule(SHEET_NAMES.FIELDS, "選択方法", selMethods);
  applyRule(SHEET_NAMES.FIELDS, "結合方法", joinMethods);
  applyRule(SHEET_NAMES.FIELDS, "データ型", dataTypes);

  // 02_ルールマスタ
  applyRule(SHEET_NAMES.RULES, "出力方式", outputModes);

  // 04_出力先設定
  applyRule(SHEET_NAMES.OUTPUT_SETTINGS, "出力方式", outputModes);
}

/**
 * =========================================
 * 5. Menu.gs 相当
 * =========================================
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('PDFデータ変換')
    .addItem('初期セットアップ', 'setupPdfDataConversionSpreadsheet')
    .addItem('設定を再確認', 'setupPdfDataConversionSpreadsheet')
    .addItem('入力規則を再設定', 'applyFormattingAndValidationsWrapper')
    .addItem('テストを実行', 'testAllSetup')
    .addSeparator()
    .addItem('完全再作成', 'rebuildPdfDataConversionSpreadsheet')
    .addToUi();
}

function applyFormattingAndValidationsWrapper() {
  applyFormattingAndValidations(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getUi().alert('書式と入力規則を再設定しました。');
}

/**
 * =========================================
 * ID自動採番 補助関数
 * =========================================
 */
function generateNextId(sheetName, prefix, padding) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return `${prefix}-001`;

  const existingIds = getExistingKeys(sheet, 1);
  let maxNum = 0;

  existingIds.forEach(id => {
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  });

  const nextNum = maxNum + 1;
  const numStr = nextNum.toString().padStart(padding, '0');
  return `${prefix}-${numStr}`;
}

function generateNextRuleId() { return generateNextId(SHEET_NAMES.RULES, "RULE", 3); }
function generateNextItemId() { return generateNextId(SHEET_NAMES.FIELDS, "ITEM", 3); }
function generateNextOutputId() { return generateNextId(SHEET_NAMES.OUTPUT_SETTINGS, "OUTPUT", 3); }
function generateNextImportId() { return generateNextId(SHEET_NAMES.IMPORT_HISTORY, "IMPORT", 5); }
function generateNextExtractionId() { return generateNextId(SHEET_NAMES.EXTRACTION_HISTORY, "EXTRACT", 5); }


/**
 * =========================================
 * 6. Api.gs 相当
 * =========================================
 */

function respond(success, data, errorObj) {
  const response = {
    success: success,
    data: data,
    error: errorObj || null,
    timestamp: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function respondError(code, message) {
  return respond(false, null, { code: code, message: message });
}

function getSheetDataAsObjects(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (!action) {
      return respondError("MISSING_ACTION", "actionが未指定です");
    }
    
    if (action === "settings") {
      const settings = getSheetDataAsObjects(SHEET_NAMES.SETTINGS);
      if (!settings) return respondError("SHEET_NOT_FOUND", "シートが見つかりません");
      
      let result = {};
      settings.forEach(s => {
        if (s["有効"] === true) {
          result[s["設定キー"]] = s["設定値"];
        }
      });
      return respond(true, result);
      
    } else if (action === "rules") {
      const rules = getSheetDataAsObjects(SHEET_NAMES.RULES);
      if (!rules) return respondError("SHEET_NOT_FOUND", "シートが見つかりません");
      
      const activeRules = rules
        .filter(r => r["有効"] === true)
        .sort((a, b) => (a["表示順"] || 999) - (b["表示順"] || 999));
        
      return respond(true, activeRules);
      
    } else if (action === "fields") {
      const ruleId = e.parameter.ruleId;
      if (!ruleId) return respondError("MISSING_RULE_ID", "ruleIdが未指定です");
      
      const fields = getSheetDataAsObjects(SHEET_NAMES.FIELDS);
      if (!fields) return respondError("SHEET_NOT_FOUND", "シートが見つかりません");
      
      // ルールの存在確認
      const rules = getSheetDataAsObjects(SHEET_NAMES.RULES) || [];
      if (!rules.find(r => r["ルールID"] === ruleId)) {
        return respondError("RULE_NOT_FOUND", "指定されたルールIDが存在しません");
      }
      
      const activeFields = fields
        .filter(f => f["ルールID"] === ruleId && f["有効"] === true)
        .sort((a, b) => (a["表示順"] || 999) - (b["表示順"] || 999));
        
      return respond(true, activeFields);
      
    } else if (action === "output-settings") {
      const ruleId = e.parameter.ruleId;
      if (!ruleId) return respondError("MISSING_RULE_ID", "ruleIdが未指定です");
      
      const settings = getSheetDataAsObjects(SHEET_NAMES.OUTPUT_SETTINGS);
      if (!settings) return respondError("SHEET_NOT_FOUND", "シートが見つかりません");
      
      const target = settings.find(s => s["ルールID"] === ruleId && s["有効"] === true);
      if (!target) {
        return respondError("OUTPUT_SETTING_NOT_FOUND", "指定されたルールIDの出力設定が存在しないか無効です");
      }
      
      return respond(true, target);
      
    } else if (action === "choices") {
      const type = e.parameter.type;
      if (!type) return respondError("MISSING_CHOICE_TYPE", "typeが未指定です");
      
      const choices = getSheetDataAsObjects(SHEET_NAMES.CHOICES);
      if (!choices) return respondError("SHEET_NOT_FOUND", "シートが見つかりません");
      
      const targetChoices = choices
        .filter(c => c["選択肢種別"] === type && c["有効"] === true)
        .sort((a, b) => (a["表示順"] || 999) - (b["表示順"] || 999));
        
      return respond(true, targetChoices);
      
    } else {
      return respondError("INVALID_ACTION", "不明なactionです");
    }
  } catch (error) {
    return respondError("INTERNAL_ERROR", error.message || String(error));
  }
}


/**
 * =========================================
 * 7. Tests.gs 相当
 * =========================================
 */

function recordTestResult(testId, testName, isSuccess, expected, actual, errorMessage) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.TEST_RESULTS);
  if (!sheet) return;
  
  sheet.appendRow([
    testId,
    testName,
    new Date(),
    isSuccess ? "PASS" : "FAIL",
    expected,
    actual,
    errorMessage || ""
  ]);
}

function runTest(testId, testName, testFunc) {
  try {
    testFunc();
    recordTestResult(testId, testName, true, "Success", "Success", "");
  } catch (e) {
    recordTestResult(testId, testName, false, "Success", "Exception", e.message || String(e));
  }
}

function testSetupSheets() {
  runTest("TEST-SETUP-01", "9シートが作成されているか", () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.values(SHEET_NAMES).forEach(name => {
      if (!ss.getSheetByName(name)) throw new Error(`シート ${name} が見つかりません`);
    });
  });
}

function testInitialSettings() {
  runTest("TEST-SETUP-02", "FULL_TEXT_EXTRACTIONがTRUEになっているか", () => {
    const settings = getSheetDataAsObjects(SHEET_NAMES.SETTINGS);
    const item = settings.find(s => s["設定キー"] === "FULL_TEXT_EXTRACTION");
    if (!item) throw new Error("FULL_TEXT_EXTRACTION が存在しません");
    if (item["設定値"] !== true) throw new Error("FULL_TEXT_EXTRACTION が TRUE ではありません");
  });
}

function testInitialRules() {
  runTest("TEST-SETUP-03", "初期ルールが登録され、固定帳票ルールが存在しない(無効化されている)か", () => {
    const rules = getSheetDataAsObjects(SHEET_NAMES.RULES);
    if (!rules.find(r => r["ルールID"] === "RULE-FREE-001")) throw new Error("RULE-FREE-001 が存在しません");
    const templateRule = rules.find(r => r["ルールID"] === "RULE-TEMPLATE-001");
    if (!templateRule) throw new Error("RULE-TEMPLATE-001 が存在しません");
    if (templateRule["有効"] !== false) throw new Error("RULE-TEMPLATE-001 が無効化(FALSE)されていません");
  });
}

function testApiSettings() {
  runTest("TEST-API-01", "API: settings 取得", () => {
    const res = doGet({ parameter: { action: "settings" } });
    const json = JSON.parse(res.getContent());
    if (!json.success) throw new Error("API失敗: " + json.error.message);
    if (json.data.FULL_TEXT_EXTRACTION !== true) throw new Error("FULL_TEXT_EXTRACTIONの値が不正です");
  });
}

function testApiRules() {
  runTest("TEST-API-02", "API: rules 取得", () => {
    const res = doGet({ parameter: { action: "rules" } });
    const json = JSON.parse(res.getContent());
    if (!json.success) throw new Error("API失敗");
    if (json.data.find(r => r["ルールID"] === "RULE-TEMPLATE-001")) {
      throw new Error("無効なルールが返却されています");
    }
  });
}

function testApiFields() {
  runTest("TEST-API-03", "API: fields 取得とエラーテスト", () => {
    let res = doGet({ parameter: { action: "fields" } });
    let json = JSON.parse(res.getContent());
    if (json.success || json.error.code !== "MISSING_RULE_ID") throw new Error("action未指定エラーの挙動が不正");
    
    res = doGet({ parameter: { action: "fields", ruleId: "INVALID-RULE" } });
    json = JSON.parse(res.getContent());
    if (json.success || json.error.code !== "RULE_NOT_FOUND") throw new Error("存在しないルールIDの挙動が不正");
    
    res = doGet({ parameter: { action: "fields", ruleId: "RULE-FREE-001" } });
    json = JSON.parse(res.getContent());
    if (!json.success || json.data.length === 0) throw new Error("正常な取得に失敗");
  });
}

function testApiOutputSettings() {
  runTest("TEST-API-04", "API: output-settings 取得", () => {
    const res = doGet({ parameter: { action: "output-settings", ruleId: "RULE-FREE-001" } });
    const json = JSON.parse(res.getContent());
    if (!json.success) throw new Error("API失敗");
  });
}

function testApiChoices() {
  runTest("TEST-API-05", "API: choices 取得", () => {
    const res = doGet({ parameter: { action: "choices", type: "selection_method" } });
    const json = JSON.parse(res.getContent());
    if (!json.success || json.data.length === 0) throw new Error("API失敗");
  });
}

function testAllSetup() {
  // 一括テスト実行
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.TEST_RESULTS);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  testSetupSheets();
  testInitialSettings();
  testInitialRules();
  
  // APIテストも連続で実行
  testApiSettings();
  testApiRules();
  testApiFields();
  testApiOutputSettings();
  testApiChoices();
  
  SpreadsheetApp.getUi().alert('テストが完了しました。09_テスト結果シートをご確認ください。');
}
