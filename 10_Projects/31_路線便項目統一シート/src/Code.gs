/**
 * イベントトリガーとメニュー登録
 */
function onOpen(e) {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("路線便データ取込・標準化")
    .addItem("CSV・Excelデータを取り込む", "importCsvExcel")
    .addItem("項目役割マスタ", "openRoleMaster")
    .addSeparator()
    .addItem("期間追加料金を登録", "showAdditionalChargeDialog")
    .addSeparator()
    .addSubMenu(ui.createMenu("【テスト用】")
      .addItem("実績運賃計算テスト環境を作成", "createFreightTestEnvironment")
      .addItem("実績運賃計算結果を確認", "verifyFreightTestResults")
      .addItem("サーチャージ明細テスト環境を作成", "createSurchargeTestEnvironment")
      .addItem("サーチャージ明細テスト結果を確認", "verifySurchargeTestResults")
      .addItem("標準化データをv2へ更新", "migrateStandardizedDataToV2")
      .addItem("25追加料金をv2(16列)へ更新", "migrateAdditionalChargeDataToV2")
      .addItem("15_取込一時データをv2(21列)へ更新", "migrateTempDataSheetToV2")
      .addItem("A〜D社 実フォーマット項目を抽出", "extractActualFormatItems")
      .addItem("A〜D社 実運賃構造を分析", "analyzeActualFreightStructure")
      .addSeparator()
      .addItem("期間追加料金 P03-P09 テストを実行", "runPeriodAdditionalChargeTests")
      .addSeparator()
      .addItem("SSoT親子連携テスト環境を作成", "createSsotTestEnvironment")
      .addItem("SSoT親子連携テスト結果を確認", "verifySsotTestResults")
      .addSeparator()
      .addItem("A2-2 再生成プレビュー検証", "verifyRebuildPreviewA22")
    )
    .addItem("標準化データ再生成プレビュー", "showRebuildPreviewDialog")
    .addItem("23_標準化出荷データを再生成", "menuRebuildStandardData")
    .addSeparator()
    .addItem("システム初期設定", "setup")
    .addToUi();
}

/**
 * メニューからのシステム構成チェック呼び出し
 */
function menuCheckSystemStructure() {
  ValidationService.checkSystemStructure();
}

/**
 * テストデータ削除処理（安全な削除）
 */
function menuDeleteTestData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert("確認", "実データは削除されません。テスト用に生成された一時データ等を削除します。よろしいですか？", ui.ButtonSet.YES_NO);
  
  if (response === ui.Button.YES) {
    ui.alert("結果", "現在削除対象となるテストデータはありません。", ui.ButtonSet.OK);
  }
}

// ==========================================
// ラッパー関数群 (RawDataControllerへの委譲)
// ==========================================

// 旧読込メニュー用のラッパー関数（A社〜D社個別メニューは廃止されました）
function importCsvExcel() { 
  const html = HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("路線便データ取込")
    .setWidth(900)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, "路線便データ取込");
}
function openRoleMaster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ROLE_MASTER);
  if (sheet) ss.setActiveSheet(sheet);
}

// HTMLダイアログからのコールバック用
function getFormatReaderInfo() { return RawDataController.getFormatReaderInfo(); }
function saveFormatReaderMapping(mappingData, formatName) { return RawDataController.saveFormatReaderMapping(mappingData, formatName); }

function getImportInitialInfo() { return RawDataController.getImportInitialInfo(); }
function saveImportSettings(settings) { RawDataController.saveImportSettings(settings); }

function generateAnalysisData(companyCode, targetMonth) { return RawDataController.generateAnalysisData(companyCode, targetMonth); }
function reconvertAnalysisData(scope, targetCompanyCode, targetMonth) { return RawDataController.reconvertAnalysisData(scope, targetCompanyCode, targetMonth); }
function showReconvertComplete() {
  SpreadsheetApp.getUi().alert("完了", "再変換処理が完了しました。", SpreadsheetApp.getUi().ButtonSet.OK);
}
function checkFormatMatch(companyCode, formatName, parsedHeaders) { return RawDataController.checkFormatMatch(companyCode, formatName, parsedHeaders); }

function initializeImport(payload) { return RawDataController.initializeImport(payload); }
function uploadChunk(payload) { return RawDataController.uploadChunk(payload); }
function initializeStandardization(payload) { return RawDataController.initializeStandardization(payload); }
function standardizeChunk(payload) { return RawDataController.standardizeChunk(payload); }
function finalizeImport(payload) { return RawDataController.finalizeImport(payload); }
function cancelImport(importId) { return RawDataController.cancelImport(importId); }

// ログ専用関数
function startImportProcess(params) { return LogService.startProcess(params); }

function createFreightTestEnvironment() { return TestManager.createFreightTestEnvironment(); }
function verifyFreightTestResults() { return TestManager.verifyFreightTestResults(); }
function extractActualFormatItems() { return TestManager.extractActualFormatItems(); }
function analyzeActualFreightStructure() { return TestManager.analyzeActualFreightStructure(); }
function createSurchargeTestEnvironment() { return TestManager.createSurchargeTestEnvironment(); }
function verifySurchargeTestResults() { return TestManager.verifySurchargeTestResults(); }
function migrateStandardizedDataToV2() { return Migration.migrateStandardizedDataToV2(); }
function migrateAdditionalChargeDataToV2() { return Migration.migrateAdditionalChargeDataToV2(); }
function migrateTempDataSheetToV2() { return Migration.migrateTempDataSheetToV2(); }
function showAdditionalChargeDialog() { return AdditionalChargeController.showDialog(); }
function apiGetValidContractProfiles() { return AdditionalChargeController.getValidContractProfiles(); }
function apiSaveAdditionalCharge(payload) { return AdditionalChargeController.saveAdditionalCharge(payload); }
function runPeriodAdditionalChargeTests() { return TestManager.runPeriodAdditionalChargeTests(); }
function createSsotTestEnvironment() { return TestManager.createSsotTestEnvironment(); }
function verifySsotTestResults() { return TestManager.verifySsotTestResults(); }
function verifyRebuildPreviewA22() { return TestManager.verifyRebuildPreviewA22(); }

function showRebuildPreviewDialog() {
  const html = HtmlService.createHtmlOutputFromFile("RebuildPreviewDialog")
    .setTitle("標準化データ再生成プレビュー")
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, "標準化データ再生成プレビュー");
}
function apiGetRebuildPreviewImportList() { return RebuildPreviewController.getImportList(); }
function apiExecuteRebuildPreview(importId) { return RebuildPreviewController.executeRebuildPreview(importId); }

// ==========================================
// 移行処理
// ==========================================
function migrateAnalysisDataSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = CONFIG.SHEET_NAMES.ANALYSIS_DATA;
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert("エラー", sheetName + " が存在しません。", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const nowStr = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyyMMdd_HHmmss");
  const backupName = sheetName + "_バックアップ_" + nowStr;
  
  // 既存のヘッダー取得
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newHeaders = CONFIG.HEADERS[sheetName];
  
  // ヘッダー構成が同一か確認 (同一ならバックアップ不要)
  if (existingHeaders.length === newHeaders.length) {
    let isSame = true;
    for (let i = 0; i < existingHeaders.length; i++) {
      if (existingHeaders[i] !== newHeaders[i]) {
        isSame = false; break;
      }
    }
    if (isSame) {
      SpreadsheetApp.getUi().alert("完了", "既存の列と最新の列構成が同一のため、移行は不要です。", SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
  }

  // バックアップの作成
  const backupSheet = sheet.copyTo(ss);
  backupSheet.setName(backupName);
  
  // 既存列の右に新しい列を追加
  const newColumnsToAdd = [];
  newHeaders.forEach(nh => {
    if (!existingHeaders.includes(nh)) {
      newColumnsToAdd.push(nh);
    }
  });

  if (newColumnsToAdd.length > 0) {
    const startCol = existingHeaders.length + 1;
    sheet.getRange(1, startCol, 1, newColumnsToAdd.length).setValues([newColumnsToAdd]);
    sheet.getRange(1, startCol, 1, newColumnsToAdd.length).setBackground("#f3f4f6").setFontWeight("bold");
  }

  SpreadsheetApp.getUi().alert("完了", `移行が完了しました。\nバックアップを作成し、新しい列を追加しました。\nバックアップ名: ${backupName}`, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ==========================================
// テスト関数群
// ==========================================

function testSetup() {
  console.log("【testSetup 開始】");
  try {
    setup();
    console.log("【testSetup 成功】エラーなく完了しました。");
  } catch (e) {
    console.error("【testSetup 失敗】" + e.message);
  }
}

function testIdGeneration() {
  console.log("【testIdGeneration 開始】");
  try {
    const id1 = IdService.generateId("TST");
    const id2 = IdService.generateId("TST");
    console.log(`生成ID 1: ${id1}`);
    console.log(`生成ID 2: ${id2}`);
    if (id1 === id2) throw new Error("同一のIDが生成されました。");
    if (id1.indexOf("TST-") !== 0) throw new Error("プレフィックスが正しくありません。");
    console.log("【testIdGeneration 成功】一意なIDが正しく発番されました。");
  } catch (e) {
    console.error("【testIdGeneration 失敗】" + e.message);
  }
}

function testInitialCarriers() {
  console.log("【testInitialCarriers 開始】");
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CARRIER);
    if (!sheet) throw new Error("路線便会社マスタが存在しません。");
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) throw new Error("初期データが登録されていません。");
    const carriers = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat();
    const expected = ["C001", "C002", "C003", "C004"];
    let allFound = true;
    expected.forEach(c => { if (carriers.indexOf(c) === -1) allFound = false; });
    if (allFound) {
      console.log("【testInitialCarriers 成功】初期4社が正しく登録されています。");
      SpreadsheetApp.getUi().alert("テスト成功", "初期4社が正しく登録されています。", SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      throw new Error("一部の路線便会社が不足しています。");
    }
  } catch (e) {
    console.error("【testInitialCarriers 失敗】" + e.message);
    SpreadsheetApp.getUi().alert("テスト失敗", e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function testHeaders() {
  console.log("【testHeaders 開始】");
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let hasError = false;
    for (const key in CONFIG.SHEET_NAMES) {
      const sheetName = CONFIG.SHEET_NAMES[key];
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        console.error(`シートがありません: ${sheetName}`);
        hasError = true;
        continue;
      }
      const expected = CONFIG.HEADERS[sheetName];
      if (!expected || expected.length === 0) continue; 
      
      const actual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
      for (let i = 0; i < expected.length; i++) {
        if (actual[i] !== expected[i]) {
          console.error(`ヘッダー不一致 [${sheetName}] ${i+1}列目: 期待[${expected[i]}] 実際[${actual[i]}]`);
          hasError = true;
        }
      }
    }
    if (hasError) {
      throw new Error("一部のシートでヘッダーが正しくありません。ログを確認してください。");
    } else {
      console.log("【testHeaders 成功】すべてのシートのヘッダーが仕様と一致しています。");
      SpreadsheetApp.getUi().alert("テスト成功", "すべてのヘッダーが正常です。", SpreadsheetApp.getUi().ButtonSet.OK);
    }
  } catch (e) {
    console.error("【testHeaders 失敗】" + e.message);
    SpreadsheetApp.getUi().alert("テスト失敗", e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function testValidations() {
  console.log("【testValidations 開始】");
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
    const keys = settingSheet.getRange(2, 1, settingSheet.getLastRow() - 1, 1).getValues().flat();
    if (keys.indexOf("INITIAL_CARRIER_COUNT") === -1) throw new Error("設定シートに必要なキーが登録されていません。");
    
    const crsSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CARRIER_SPEC);
    const crsRule = crsSheet.getRange("H2").getDataValidation();
    if (!crsRule || crsRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      throw new Error("運送会社指定シートにプルダウンが設定されていません。");
    }
    
    const destSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DESTINATION);
    const chkRule = destSheet.getRange("J2").getDataValidation();
    if (!chkRule || chkRule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
      throw new Error("届け先マスタのチェックボックスが設定されていません。");
    }
    
    console.log("【testValidations 成功】プルダウン、チェックボックス、初期設定値が正しく設定されています。");
    SpreadsheetApp.getUi().alert("テスト成功", "入力規則・設定値のテストが成功しました。", SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    console.error("【testValidations 失敗】" + e.message);
    SpreadsheetApp.getUi().alert("テスト失敗", e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Webアプリケーション(GETリクエスト)
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('路線便分析システム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}