/**
 * Phase 1構造 → Phase 2構造へ移行するための履歴・再現用コード
 * (常時実行される本番コードではありません)
 * 
 * Phase 2 Migration Script
 * 冪等性を持ち、事前検証・バックアップ・事後検証を完全に行います。
 */
function migratePhase2() {
  const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is not set in ScriptProperties.');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // ==========================================
  // 1. 事前検証
  // ==========================================
  Logger.log("--- 1. 事前検証を開始します ---");
  const requiredSheets = [
    "02_タリフ基本", "03_地域定義", "04_条件帯定義", 
    "05_運賃表", "07_ルール条件", "08_ルール処理"
  ];
  const sheets = {};
  for (const name of requiredSheets) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error(`事前検証エラー: シート '${name}' が見つかりません。`);
    sheets[name] = sheet;
  }

  function findUniqueRowIndex(sheetName, idColumn, idValue) {
    const sheet = sheets[sheetName];
    const data = sheet.getDataRange().getValues();
    const idColIdx = data[0].indexOf(idColumn);
    if (idColIdx === -1) throw new Error(`事前検証エラー: ${sheetName} に列 ${idColumn} がありません。`);
    
    let foundIndex = -1;
    let matchCount = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIdx] === idValue) {
        foundIndex = i + 1; // 1-indexed
        matchCount++;
      }
    }
    if (matchCount === 0) throw new Error(`事前検証エラー: ${sheetName} に対象ID '${idValue}' が見つかりません。`);
    if (matchCount > 1) throw new Error(`事前検証エラー: ${sheetName} に対象ID '${idValue}' が ${matchCount} 件存在します。(1件のみ許容)`);
    return foundIndex;
  }

  const testIds = [
    { s: "02_タリフ基本", col: "tariff_id", val: "T_A_2026" },
    { s: "02_タリフ基本", col: "tariff_id", val: "T_B_2026" },
    { s: "02_タリフ基本", col: "tariff_id", val: "T_C_2026" },
    { s: "02_タリフ基本", col: "tariff_id", val: "T_D_2026" },
    { s: "03_地域定義", col: "region_id", val: "REG_A_2026_OUT" },
    { s: "04_条件帯定義", col: "tier_id", val: "TIER_A_2026_10" },
    { s: "04_条件帯定義", col: "tier_id", val: "TIER_A_2026_20" },
    { s: "04_条件帯定義", col: "tier_id", val: "TIER_A_2026_30" },
    { s: "04_条件帯定義", col: "tier_id", val: "TIER_A_2025_10" },
    { s: "04_条件帯定義", col: "tier_id", val: "TIER_A_2025_20" },
    { s: "04_条件帯定義", col: "tier_id", val: "TIER_B_2026_ALL" },
    { s: "04_条件帯定義", col: "tier_id", val: "TIER_C_2026_50" },
    { s: "04_条件帯定義", col: "tier_id", val: "TIER_D_2026_100" },
    { s: "05_運賃表", col: "record_id", val: "REC_D_2026_01" },
    { s: "07_ルール条件", col: "condition_id", val: "C_A_2026_01_3" },
    { s: "08_ルール処理", col: "action_id", val: "ACT_B_2026_01" },
    { s: "08_ルール処理", col: "action_id", val: "ACT_C_2026_01" },
    { s: "08_ルール処理", col: "action_id", val: "ACT_C_2026_02" },
    { s: "08_ルール処理", col: "action_id", val: "ACT_D_2026_01" }
  ];
  for (const t of testIds) {
    findUniqueRowIndex(t.s, t.col, t.val);
  }
  Logger.log("事前検証クリア。");

  // ==========================================
  // 1-2. バックアップ自動作成
  // ==========================================
  Logger.log("--- 1-2. バックアップの作成を開始します ---");
  try {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const backupName = ss.getName() + "_Phase2_Backup_" + timestamp;
    DriveApp.getFileById(SPREADSHEET_ID).makeCopy(backupName);
    Logger.log(`バックアップを ${backupName} として作成しました。`);
  } catch (e) {
    Logger.log("バックアップ作成失敗: " + e.message);
    throw new Error("バックアップの作成に失敗しました。DriveAppの実行権限を確認してください。");
  }

  // ==========================================
  // 2. 列の追加
  // ==========================================
  Logger.log("--- 2. 列の追加を開始します ---");
  function addColumnsIfNotExist(sheetName, newColumns) {
    const sheet = sheets[sheetName];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
    let startCol = headers.length + 1;
    for (const colName of newColumns) {
      if (headers.indexOf(colName) === -1) {
        sheet.getRange(1, startCol).setValue(colName);
        startCol++;
      }
    }
  }
  const newCols02 = ["weight_calculation_method", "rounding_unit"];
  const newCols04 = ["lower_inclusive", "upper_inclusive", "upper_unbounded"];
  const newCols08 = ["source_field", "subtract_value"];
  
  addColumnsIfNotExist("02_タリフ基本", newCols02);
  addColumnsIfNotExist("04_条件帯定義", newCols04);
  addColumnsIfNotExist("08_ルール処理", newCols08);

  // ==========================================
  // 3. データの更新
  // ==========================================
  Logger.log("--- 3. データの更新を開始します ---");

  // (3-1) 全レコードのデフォルト埋め
  function setDefaultsForAllRows(sheetName, getDefaultsFn) {
    const sheet = sheets[sheetName];
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    for (let i = 1; i < data.length; i++) {
      const rowData = data[i];
      const defaults = getDefaultsFn(rowData, headers);
      if (!defaults) continue;
      for (const [colName, defaultVal] of Object.entries(defaults)) {
        const colIdx = headers.indexOf(colName);
        if (colIdx === -1) throw new Error(`${sheetName} に ${colName} 列がありません。`);
        const currentVal = rowData[colIdx];
        if (currentVal === "" || currentVal == null) {
          sheet.getRange(i + 1, colIdx + 1).setValue(defaultVal);
        }
      }
    }
  }

  setDefaultsForAllRows("02_タリフ基本", (row, headers) => {
    if (!row[headers.indexOf("tariff_id")]) return null;
    return {
      weight_calculation_method: "actual",
      rounding_unit: 1
    };
  });

  setDefaultsForAllRows("04_条件帯定義", (row, headers) => {
    if (!row[headers.indexOf("tier_id")]) return null;
    const minVal = Number(row[headers.indexOf("min_value")]);
    // 第1帯のみ lower=true, それ以外は一旦 lower=false にする
    return {
      lower_inclusive: (minVal === 0) ? true : false,
      upper_inclusive: true,
      upper_unbounded: false
    };
  });

  setDefaultsForAllRows("08_ルール処理", (row, headers) => {
    if (!row[headers.indexOf("action_id")]) return null;
    return {
      source_field: "",
      subtract_value: ""
    };
  });

  // (3-2) 特定レコードの個別上書き
  function updateData(sheetName, idColumn, idValue, updates) {
    const sheet = sheets[sheetName];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowIdx = findUniqueRowIndex(sheetName, idColumn, idValue);
    for (const [fieldName, newValue] of Object.entries(updates)) {
      const colIdx = headers.indexOf(fieldName);
      if (colIdx === -1) throw new Error(`${sheetName} に列 '${fieldName}' が見つかりません。`);
      const currentCell = sheet.getRange(rowIdx, colIdx + 1);
      if (String(currentCell.getValue()) !== String(newValue)) {
        currentCell.setValue(newValue);
      }
    }
  }

  updateData("02_タリフ基本", "tariff_id", "T_B_2026", { weight_calculation_method: "max" });
  updateData("02_タリフ基本", "tariff_id", "T_D_2026", { rounding_unit: 10, default_rounding_rule: "floor" });

  updateData("03_地域定義", "region_id", "REG_A_2026_OUT", { prefecture: "沖縄県", city: "*" });

  // A 2026
  updateData("04_条件帯定義", "tier_id", "TIER_A_2026_10", { min_value: 0, max_value: 10, lower_inclusive: true, upper_inclusive: true, upper_unbounded: false });
  updateData("04_条件帯定義", "tier_id", "TIER_A_2026_20", { min_value: 10, max_value: 20, lower_inclusive: false, upper_inclusive: true, upper_unbounded: false });
  updateData("04_条件帯定義", "tier_id", "TIER_A_2026_30", { min_value: 20, max_value: 30, lower_inclusive: false, upper_inclusive: true, upper_unbounded: false });

  // A 2025
  updateData("04_条件帯定義", "tier_id", "TIER_A_2025_10", { min_value: 0, max_value: 10, lower_inclusive: true, upper_inclusive: true, upper_unbounded: false });
  updateData("04_条件帯定義", "tier_id", "TIER_A_2025_20", { min_value: 10, max_value: 20, lower_inclusive: false, upper_inclusive: true, upper_unbounded: false });

  // B 2026 (99999は仮の無制限であるため)
  updateData("04_条件帯定義", "tier_id", "TIER_B_2026_ALL", { max_value: "", lower_inclusive: true, upper_inclusive: true, upper_unbounded: true });

  // C 2026
  updateData("04_条件帯定義", "tier_id", "TIER_C_2026_50", { max_value: "", lower_inclusive: true, upper_inclusive: true, upper_unbounded: true });

  // D 2026 (100は上限であり、100kg超は計算不可)
  updateData("04_条件帯定義", "tier_id", "TIER_D_2026_100", { min_value: 0, max_value: 100, lower_inclusive: true, upper_inclusive: true, upper_unbounded: false });

  updateData("05_運賃表", "record_id", "REC_D_2026_01", { base_amount: 5003 });

  updateData("07_ルール条件", "condition_id", "C_A_2026_01_3", { condition_value: 20 });

  updateData("08_ルール処理", "action_id", "ACT_B_2026_01", { action_type: "multiply_field_add", action_value: 800, source_field: "piece_count", subtract_value: 1, calculation_target: "subtotal" });
  updateData("08_ルール処理", "action_id", "ACT_C_2026_01", { action_value: 50 });
  updateData("08_ルール処理", "action_id", "ACT_C_2026_02", { action_value: 3500 });
  updateData("08_ルール処理", "action_id", "ACT_D_2026_01", { action_value: 823 });

  // ==========================================
  // 4. 事後検証
  // ==========================================
  Logger.log("--- 4. 事後検証を開始します ---");
  
  function verifyHeaders(sheetName, expectedNewCols) {
    const sheet = sheets[sheetName];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    for (const col of expectedNewCols) {
      const matches = headers.filter(h => h === col);
      if (matches.length === 0) throw new Error(`事後検証エラー: ${sheetName} に列 '${col}' が存在しません。`);
      if (matches.length > 1) throw new Error(`事後検証エラー: ${sheetName} に列 '${col}' が重複しています。`);
    }
  }
  verifyHeaders("02_タリフ基本", newCols02);
  verifyHeaders("04_条件帯定義", newCols04);
  verifyHeaders("08_ルール処理", newCols08);

  function verify(sheetName, idColumn, idValue, checkField, expected) {
    const rowIdx = findUniqueRowIndex(sheetName, idColumn, idValue);
    const headers = sheets[sheetName].getRange(1, 1, 1, sheets[sheetName].getLastColumn()).getValues()[0];
    const val = String(sheets[sheetName].getRange(rowIdx, headers.indexOf(checkField) + 1).getValue());
    if (val.toLowerCase() !== String(expected).toLowerCase()) {
      throw new Error(`事後検証エラー: ${sheetName} ${idValue} の ${checkField} が ${val} です`);
    }
  }

  verify("02_タリフ基本", "tariff_id", "T_A_2026", "weight_calculation_method", "actual");
  verify("02_タリフ基本", "tariff_id", "T_B_2026", "weight_calculation_method", "max");
  verify("02_タリフ基本", "tariff_id", "T_D_2026", "rounding_unit", "10");
  
  verify("03_地域定義", "region_id", "REG_A_2026_OUT", "prefecture", "沖縄県");
  
  verify("04_条件帯定義", "tier_id", "TIER_C_2026_50", "upper_unbounded", "true");
  
  verify("05_運賃表", "record_id", "REC_D_2026_01", "base_amount", "5003");
  verify("07_ルール条件", "condition_id", "C_A_2026_01_3", "condition_value", "20");
  verify("08_ルール処理", "action_id", "ACT_B_2026_01", "source_field", "piece_count");
  verify("08_ルール処理", "action_id", "ACT_C_2026_01", "action_value", "50");
  verify("08_ルール処理", "action_id", "ACT_C_2026_02", "action_value", "3500");
  verify("08_ルール処理", "action_id", "ACT_D_2026_01", "action_value", "823");

  function verifyAllRows(sheetName, idColumn, checkFn) {
    const data = sheets[sheetName].getDataRange().getValues();
    const headers = data[0];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const idVal = row[headers.indexOf(idColumn)];
      if (!idVal) continue;
      
      const rowObj = {};
      headers.forEach((h, idx) => rowObj[h] = row[idx]);
      
      const errMsg = checkFn(rowObj, i + 1);
      if (errMsg) throw new Error(`全行検証エラー: ${sheetName} 行 ${i + 1} (${idVal}): ${errMsg}`);
    }
  }

  verifyAllRows("02_タリフ基本", "tariff_id", (r) => {
    if (!["actual", "max", "volumetric"].includes(r.weight_calculation_method)) return `weight_calculation_methodが不正: ${r.weight_calculation_method}`;
    const ru = Number(r.rounding_unit);
    if (isNaN(ru) || ru <= 0) return `rounding_unitが0より大きい数値ではありません: ${r.rounding_unit}`;
    return null;
  });

  verifyAllRows("04_条件帯定義", "tier_id", (r) => {
    for (const f of ["lower_inclusive", "upper_inclusive", "upper_unbounded"]) {
      const valStr = String(r[f]).toLowerCase();
      if (valStr !== "true" && valStr !== "false") return `${f} がbooleanではありません: ${r[f]}`;
    }
    return null;
  });

  verifyAllRows("08_ルール処理", "action_id", (r) => {
    if (typeof r.source_field !== "string" && r.source_field !== "") return `source_fieldが文字列ではありません`;
    if (r.subtract_value !== "" && isNaN(Number(r.subtract_value))) return `subtract_valueが数値または空文字ではありません`;
    return null;
  });

  // ==========================================
  // 5. ステータス保存
  // ==========================================
  Logger.log("全事後検証を完全PASSしました。");
  PropertiesService.getScriptProperties().setProperty('PHASE2_MIGRATION_STATUS', 'COMPLETED');
  Logger.log("PHASE2_MIGRATION_STATUS = COMPLETED に設定しました。");
}
