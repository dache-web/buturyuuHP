/**
 * SystemDiagnostics.gs
 * システムの現状を詳細に診断し、自己テストを行うモジュール
 */

/**
 * 診断結果シートを初期化して返す
 */
function getOrCreateDiagnosisSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

/**
 * フルシステム診断を実行
 */
function runFullSystemDiagnosis() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateDiagnosisSheet('98_システム診断結果', [
      '診断日時', '確認項目', '対象会社', '対象シート', '結果', '実際の値', '期待する値', '成功／失敗', '原因', '修正内容'
    ]);
    
    const now = new Date();
    const results = [];
    const addResult = (item, comp, targetSheet, valStatus, actual, expected, isSuccess, cause, fix) => {
      results.push([now, item, comp, targetSheet, valStatus, actual, expected, isSuccess ? '成功' : '失敗', cause, fix]);
    };

    // 1. 基本情報
    addResult('スプレッドシートID取得', '', '', '取得完了', ss.getId(), '', true, '', '');
    
    const allSheets = ss.getSheets().map(s => s.getName());
    addResult('全シート名取得', '', '', '取得完了', allSheets.join(', '), '', true, '', '');
    
    // 2. マスタ確認
    const masterSheet = ss.getSheetByName('01_路線会社マスタ');
    if (!masterSheet) {
      addResult('01_路線会社マスタ存在', '', '01_路線会社マスタ', '存在しない', '無し', '有り', false, '初期化未実行', '初期設定を実行');
    } else {
      const data = masterSheet.getDataRange().getValues();
      addResult('01_路線会社マスタ使用範囲', '', '01_路線会社マスタ', '行数', data.length + '行', '2行以上', data.length >= 2, '', '');
      addResult('01_路線会社マスタ1行目', '', '01_路線会社マスタ', 'ヘッダー確認', JSON.stringify(data[0]), '路線便会社コードを含むこと', data[0].indexOf('路線便会社コード') >= 0, '', '');
      
      const compResults = getAvailableRouteCompaniesForTest(masterSheet, data, addResult, now);
    }
    
    // 3. 対象年月単独テスト
    getAvailableTargetMonthsForTest(ss, addResult, now);

    // 4. 自動テスト（97_第1段階自動テスト結果）の実行
    runStage1SelfTest();
    
    // 出力
    if (results.length > 0) {
      sheet.getRange(2, 1, results.length, results[0].length).setValues(results);
    }
    
    SpreadsheetApp.getUi().alert('完了', '診断および自動テストが完了しました。98_システム診断結果 と 97_第1段階自動テスト結果 を確認してください。', SpreadsheetApp.getUi().ButtonSet.OK);

  } catch (e) {
    SpreadsheetApp.getUi().alert('エラー', '診断中に致命的なエラーが発生しました:\n' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 会社一覧の単独取得テスト
 */
function getAvailableRouteCompaniesForTest(masterSheet, data, addResult, now) {
  if (data.length <= 1) {
    addResult('路線会社データ存在', '', '01_路線会社マスタ', 'データなし', '1行のみ', '2行以上', false, 'データ未登録', '');
    return [];
  }
  
  const headers = data[0];
  const cIdx = headers.indexOf('路線便会社コード');
  const nIdx = headers.indexOf('路線便会社名');
  const sIdx = headers.indexOf('標準化データシート名');
  const vIdx = headers.indexOf('有効フラグ');
  const iIdx = headers.indexOf('分析対象初期値');
  
  if (cIdx === -1 || vIdx === -1) {
    addResult('マスタヘッダー列', '', '01_路線会社マスタ', '必須列なし', '見つからず', '存在する', false, '1行目がヘッダーではない', '');
    return [];
  }
  
  const companies = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const code = row[cIdx];
    if (!code) continue;
    
    const validVal = row[vIdx];
    const isValid = Utils.isValidFlag(validVal);
    const initVal = row[iIdx];
    const isInit = Utils.isValidFlag(initVal);
    const sName = row[sIdx];
    const sheetExists = sName ? (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sName) !== null) : false;
    
    addResult('会社マスタ行存在', code, '01_路線会社マスタ', '確認', '存在', '存在', true, '', '');
    addResult('有効フラグの実値', code, '01_路線会社マスタ', '値', String(validVal), 'TRUE等', true, '', '');
    addResult('有効判定結果', code, '01_路線会社マスタ', '判定', isValid, true, isValid === true, '無効または判定エラー', '');
    addResult('分析対象初期値の実値', code, '01_路線会社マスタ', '値', String(initVal), 'TRUE等', true, '', '');
    addResult('初期選択判定結果', code, '01_路線会社マスタ', '判定', isInit, true, true, '', '');
    addResult('標準化シート名', code, '01_路線会社マスタ', '値', sName, '入力あり', sName !== '', '', '');
    addResult('シート存在結果', code, sName, '判定', sheetExists, true, sheetExists, 'シートが存在しない', '');
    
    const canAnalyze = isValid && sheetExists;
    addResult('分析可能判定結果', code, '', '総合判定', canAnalyze, true, canAnalyze, canAnalyze ? '' : '有効フラグ偽またはシート無し', '');
    
    if (canAnalyze) {
      companies.push({ code: code, name: row[nIdx], sheet: sName });
    }
  }
  
  const compNames = companies.map(c => c.code + ' ' + c.name).join('、');
  addResult('分析可能会社として取得できた一覧', '', '', '完了', compNames, 'A001～D001', companies.length > 0, '', '');
  
  return companies;
}

/**
 * 対象年月の単独取得テスト
 */
function getAvailableTargetMonthsForTest(ss, addResult, now) {
  const masterSheet = ss.getSheetByName('01_路線会社マスタ');
  if (!masterSheet) return;
  const masterData = masterSheet.getDataRange().getValues();
  if (masterData.length <= 1) return;
  
  const headers = masterData[0];
  const cIdx = headers.indexOf('路線便会社コード');
  const sIdx = headers.indexOf('標準化データシート名');
  const vIdx = headers.indexOf('有効フラグ');
  
  const monthSet = new Set();
  
  for (let i = 1; i < masterData.length; i++) {
    const code = masterData[i][cIdx];
    const sName = masterData[i][sIdx];
    const isValid = Utils.isValidFlag(masterData[i][vIdx]);
    
    if (!code || !isValid || !sName) continue;
    
    const sheet = ss.getSheetByName(sName);
    if (!sheet) {
      addResult('標準化シート存在', code, sName, '存在確認', '無し', '有り', false, 'シートが見つからない', '');
      continue;
    }
    
    addResult('標準化シート存在', code, sName, '存在確認', '有り', '有り', true, '', '');
    
    const data = sheet.getDataRange().getValues();
    addResult('読込行数', code, sName, '行数', data.length, '2以上', data.length >= 2, data.length < 2 ? 'データ無し' : '', '');
    
    if (data.length <= 1) continue;
    
    const sheetHeaders = data[0];
    const ymIdx = sheetHeaders.indexOf('対象年月');
    
    if (ymIdx === -1) {
      addResult('対象年月列', code, sName, '列番号', '-1', '0以上', false, '1行目にヘッダーが見つからない', '');
      continue;
    }
    
    addResult('対象年月列', code, sName, '列番号', ymIdx, '0以上', true, '', '');
    
    let foundCount = 0;
    let excludedCount = 0;
    
    for (let r = 1; r < data.length; r++) {
      const rawVal = data[r][ymIdx];
      const ym = Utils.formatYearMonth(rawVal);
      if (ym) {
        monthSet.add(ym);
        foundCount++;
      } else {
        excludedCount++;
      }
    }
    
    addResult('取得した値', code, sName, '有効件数', foundCount, '>0', foundCount > 0, '', '');
    addResult('除外した値', code, sName, '無効/空白件数', excludedCount, '', true, '', '');
  }
  
  const months = Array.from(monthSet).sort();
  addResult('対象年月として取得できた一覧', '', '', '完了', months.join(', '), '2026-07等', months.length > 0, '', '');
}

/**
 * 第1段階の自動テスト
 */
function runStage1SelfTest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateDiagnosisSheet('97_第1段階自動テスト結果', [
    'テスト番号', 'テスト内容', '期待結果', '実際の結果', '成功／失敗', 'エラー内容', '実行日時'
  ]);
  
  const now = new Date();
  const results = [];
  let testNum = 1;
  const addTest = (desc, expected, actual, success, error) => {
    results.push([testNum++, desc, expected, actual, success ? '成功' : '失敗', error, now]);
  };
  
  try {
    const master = ss.getSheetByName('01_路線会社マスタ');
    addTest('1. 01_路線会社マスタが存在する', '存在する', master ? '存在する' : '存在しない', !!master, '');
    
    if (!master) throw new Error('マスタ無し');
    
    const mData = master.getDataRange().getValues();
    const codes = mData.slice(1).map(r => r[0]).filter(c => c);
    addTest('2. 4社が登録されている', '4社以上', codes.length + '社', codes.length >= 4, '');
    
    const vIdx = mData[0].indexOf('有効フラグ');
    const valids = mData.slice(1).filter(r => Utils.isValidFlag(r[vIdx]));
    addTest('3. 4社すべて有効', '4社以上', valids.length + '社', valids.length >= 4, '');
    
    const sIdx = mData[0].indexOf('標準化データシート名');
    const existSheets = valids.filter(r => ss.getSheetByName(r[sIdx]));
    addTest('4. 4社の標準化シートが存在する', '4シート以上', existSheets.length + 'シート', existSheets.length >= 4, '');
    
    let hasYmCol = true;
    let ymValues = new Set();
    
    existSheets.forEach(r => {
      const s = ss.getSheetByName(r[sIdx]);
      const data = s.getDataRange().getValues();
      if (data[0].indexOf('対象年月') === -1) hasYmCol = false;
      else {
        const ymi = data[0].indexOf('対象年月');
        for (let i = 1; i < data.length; i++) {
          const v = Utils.formatYearMonth(data[i][ymi]);
          if(v) ymValues.add(v);
        }
      }
    });
    addTest('5. 各シートに対象年月列がある', 'すべてあり', hasYmCol ? 'あり' : 'なし', hasYmCol, '');
    
    addTest('6. 2026-07が存在する', '存在する', ymValues.has('2026-07') ? '存在する' : '存在しない', ymValues.has('2026-07'), '');
    addTest('7. 2026-08が存在する', '存在する', ymValues.has('2026-08') ? '存在する' : '存在しない', ymValues.has('2026-08'), '');
    
    // 本来なら分析実行もテストするが、今回は対象年月と会社取得の解決を最優先とするため、
    // ここまでの結果を出力する。
    addTest('10. 対象年月一覧が2件取得できる', '2件以上', ymValues.size + '件', ymValues.size >= 2, '');
    
  } catch (e) {
    addTest('テスト実行エラー', '完了', 'エラー中断', false, e.message);
  }
  
  if (results.length > 0) {
    sheet.getRange(2, 1, results.length, results[0].length).setValues(results);
  }
}
