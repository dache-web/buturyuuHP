/**
 * 路線便運賃分析・削減検証システム (第1段階)
 * メインコントロール
 */

/**
 * スプレッドシートを開いたときの処理
 */
function onOpen(e) {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('路線便運賃分析')
    .addItem('初期設定', 'runInitialSetup')
    .addSeparator()
    .addItem('分析を実行する', 'showAnalysisDialog')
    .addSeparator()
    .addItem('会社別貼付シートを作成する', 'createPasteSheets')
    .addSeparator()
    .addSubMenu(ui.createMenu('【テスト用】')
      .addItem('テスト環境を作成する', 'runCreateTestEnvironment')
      .addItem('システム診断を実行する', 'runFullSystemDiagnosis')
    )
    .addToUi();
}

/**
 * 初期設定の実行
 */
function runInitialSetup() {
  const ui = SpreadsheetApp.getUi();
  try {
    SheetManager.setup();
    SheetManager.ensureCompanySheets();
    ui.alert('完了', '初期設定（必須シート・会社別シートの作成）が完了しました。', ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('エラー', '初期設定中にエラーが発生しました:\n' + e.message, ui.ButtonSet.OK);
  }
}

/**
 * テスト環境の作成を実行
 */
function runCreateTestEnvironment() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('確認', '現在のシートをすべて削除し、テスト環境（4社分のシートとダミーデータ）を全自動で構築します。実行しますか？', ui.ButtonSet.YES_NO);
  
  if (response === ui.Button.YES) {
    try {
      TestEnvironment.createTestEnvironment();
      ui.alert('完了', 'テスト環境の作成が完了しました。\n\n対象期間:\n2026-07\n2026-08\n\n路線会社:\nテスト運輸A\nテスト運輸B\nテスト運輸C\nテスト運輸D\n\n上部メニューから「分析を実行する」を押してください。', ui.ButtonSet.OK);
    } catch(e) {
      ui.alert('エラー', 'テスト環境の構築中にエラーが発生しました:\n' + e.message + '\n' + e.stack, ui.ButtonSet.OK);
    }
  }
}

/**
 * 分析ダイアログの表示
 */
function showAnalysisDialog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('00_システム設定')) {
    SpreadsheetApp.getUi().alert('エラー', '先に「路線便運賃分析」メニューから「初期設定」または「テスト環境を作成する」を実行してください。', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  const template = HtmlService.createTemplateFromFile('index');
  const html = template.evaluate()
      .setTitle('路線便運賃分析')
      .setWidth(600)
      .setHeight(700);
      
  SpreadsheetApp.getUi().showModalDialog(html, '路線便運賃分析');
}

/**
 * 会社別貼付シートの作成
 */
function createPasteSheets() {
  const ui = SpreadsheetApp.getUi();
  try {
    SheetManager.ensureCompanySheets();
    ui.alert('完了', '有効な路線会社の貼付用シートを確認・作成しました。', ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('エラー', e.message, ui.ButtonSet.OK);
  }
}

/**
 * 画面用の初期データを取得する（HTMLから呼び出し）
 */
function getAnalysisScreenInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName('01_路線会社マスタ');
  
  const result = {
    success: false,
    targetMonths: [],
    companies: [],
    initialSelectedCompany: null,
    companyCounts: {},
    settingsErrors: [],
    missingSheets: [],
    missingColumns: [],
    errorDetails: ''
  };

  if (!masterSheet) {
    result.settingsErrors.push('01_路線会社マスタ シートが存在しません。');
    result.errorDetails = '初期設定が完了していないか、マスタシートが削除されています。';
    return result;
  }

  const masterData = masterSheet.getDataRange().getValues();
  if (masterData.length <= 1) {
    result.settingsErrors.push('01_路線会社マスタ にデータが登録されていません。');
    return result;
  }

  const headers = masterData[0];
  const cIdx = headers.indexOf('路線便会社コード');
  const nIdx = headers.indexOf('路線便会社名');
  const sIdx = headers.indexOf('標準化データシート名');
  const vIdx = headers.indexOf('有効フラグ');
  const iIdx = headers.indexOf('分析対象初期値');

  if (cIdx === -1 || vIdx === -1 || sIdx === -1) {
    result.missingColumns.push('01_路線会社マスタ: 路線便会社コード, 有効フラグ, 標準化データシート名');
    result.errorDetails = 'マスタシートの1行目に必須の列名が見つかりません。';
    return result;
  }

  const monthSet = new Set();
  
  for (let i = 1; i < masterData.length; i++) {
    const code = masterData[i][cIdx];
    const name = masterData[i][nIdx] || code;
    const sName = masterData[i][sIdx];
    const isValid = Utils.isValidFlag(masterData[i][vIdx]);
    const isInit = iIdx !== -1 ? Utils.isValidFlag(masterData[i][iIdx]) : false;
    
    if (!code || !isValid) continue;

    if (!sName) {
      result.settingsErrors.push(`${name} の標準化データシート名が空欄です。`);
      continue;
    }

    const dataSheet = ss.getSheetByName(sName);
    if (!dataSheet) {
      result.missingSheets.push(sName);
      continue;
    }

    const data = dataSheet.getDataRange().getValues();
    if (data.length <= 1) {
      result.companyCounts[code] = 0;
      continue;
    }

    const dHeaders = data[0];
    const ymIdx = dHeaders.indexOf('対象年月');
    
    if (ymIdx === -1) {
      result.missingColumns.push(`${sName}: 対象年月`);
      continue;
    }

    let count = 0;
    for (let r = 1; r < data.length; r++) {
      const ym = Utils.formatYearMonth(data[r][ymIdx]);
      if (ym) {
        monthSet.add(ym);
        count++;
      }
    }
    
    result.companyCounts[code] = count;
    result.companies.push({ code: code, name: name, sheet: sName, initialSelect: isInit });
  }

  result.targetMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  
  if (result.targetMonths.length > 0 && result.companies.length > 0) {
    result.success = true;
  } else {
    if (result.companies.length === 0 && result.missingSheets.length === 0 && result.settingsErrors.length === 0) {
      result.errorDetails = '有効な路線会社が1件もありません。';
    } else if (result.targetMonths.length === 0) {
      result.errorDetails = '対象年月データが1件も見つかりませんでした。';
    }
  }

  return result;
}

/**
 * HTMLのインクルード用関数
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 取込処理の第1段階（ファイル解析）を呼び出す
 */
function processUpload(base64Data, fileName, mimeType) {
  return ImportHandler.processUpload(base64Data, fileName, mimeType);
}

/**
 * 取込処理の第2段階（正式登録）を呼び出す
 */
function registerData(processId, targetCompanyCode) {
  return Utils.withLock(() => {
    return ImportHandler.registerData(processId, targetCompanyCode);
  });
}

/**
 * 分析処理の実行（HTMLから呼び出し）
 */
function executeAnalysis(params) {
  try {
    if (!params.selectedCompanies || params.selectedCompanies.length === 0) {
      throw new Error('分析対象の路線会社を1社以上選択してください。');
    }
    
    // 排他制御を用いて実行
    const result = Utils.withLock(() => {
      return Analyzer.runAnalysis(params);
    });
    
    return { success: true, data: result };
  } catch (e) {
    Utils.logDetailedError('分析実行', 'executeAnalysis', e, '分析パラメタ: ' + JSON.stringify(params));
    return { success: false, error: e.message };
  }
}
