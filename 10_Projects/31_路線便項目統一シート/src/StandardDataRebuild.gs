/**
 * 23_標準化出荷データの再生成および自動テスト専用処理
 */

function menuRebuildStandardData() {
  const ui = SpreadsheetApp.getUi();
  const msg = "【確認】\n23_標準化出荷データのみを削除して再生成します。\n\n" +
              "削除対象：\n・23_標準化出荷データ\n\n" +
              "残すもの：\n・A～D社原本データ\n・各種マスタ\n・マッピング設定\n\n" +
              "よろしいですか？";
  const response = ui.alert("再生成の確認", msg, ui.ButtonSet.YES_NO);
  
  if (response === ui.Button.YES) {
    executeStandardDataRebuild();
  }
}

function executeStandardDataRebuild() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = CONFIG.SHEET_NAMES.ANALYSIS_DATA;
  const sheet = ss.getSheetByName(sheetName);
  const ui = SpreadsheetApp.getUi();
  
  if (!sheet) {
    ui.alert("再生成失敗", "原因:\n対象シート (23_標準化出荷データ) が存在しません。", ui.ButtonSet.OK);
    return;
  }
  
  try {
    // 1. 23_標準化出荷データを初期化
    sheet.clear();
    const headers = CONFIG.STANDARDIZED_CSV_HEADERS;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 2. A社データを取得 (18_A社_原本貼付)
    const rawSheetName = CONFIG.SHEET_NAMES.RAW_A;
    const rawSheet = ss.getSheetByName(rawSheetName);
    if (!rawSheet || rawSheet.getLastRow() < 2) {
      throw new Error(`A社原本データ (${rawSheetName}) が見つからないか、データがありません。`);
    }
    
    const rawData = rawSheet.getDataRange().getValues();
    
    // 3. 既存のA社マッピング設定を取得
    const roleSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ROLE_MASTER);
    if (!roleSheet || roleSheet.getLastRow() < 2) {
      throw new Error("項目役割マスタが存在しないか、データがありません。");
    }
    
    const roleData = roleSheet.getDataRange().getValues();
    const companyCode = "CARRIER_A";
    const mapping = [];
    
    // roleData[0] はヘッダー
    for (let i = 1; i < roleData.length; i++) {
      if (roleData[i][2] === companyCode) {
        mapping.push({
          originalName: roleData[i][3],
          originalIndex: Number(roleData[i][4]) - 1, // 1始まりを0始まりに
          commonField: roleData[i][5],
          joinGroupId: roleData[i][9],
          joinOrder: Number(roleData[i][10]),
          joinMethod: roleData[i][11]
        });
      }
    }
    
    if (mapping.length === 0) {
      throw new Error("A社のマッピング設定が見つかりません。");
    }
    
    // 3.5 取込フォーマット設定から計算ルールを取得（固定indexを使わずヘッダー名で列を特定）
    const fmtSheet = ss.getSheetByName("12_取込フォーマット設定");
    let calcMethod = "直接取得";
    let calcRuleArray = [];
    if (fmtSheet && fmtSheet.getLastRow() > 0) {
      const fmtData = fmtSheet.getDataRange().getValues();
      const fmtHeaders = fmtData[0];
      const compCodeIdx = fmtHeaders.indexOf("路線便会社コード");
      const methodIdx = fmtHeaders.indexOf("実績運賃計算方式");
      const ruleIdx = fmtHeaders.indexOf("実績運賃計算ルール");
      
      for (let i = 1; i < fmtData.length; i++) {
        if (compCodeIdx > -1 && fmtData[i][compCodeIdx] === companyCode) {
          if (methodIdx > -1) calcMethod = fmtData[i][methodIdx] || "直接取得";
          if (ruleIdx > -1) {
            const ruleStr = fmtData[i][ruleIdx];
            if (ruleStr) {
              try {
                const parsed = JSON.parse(ruleStr);
                if (parsed && parsed.fields) calcRuleArray = parsed.fields;
              } catch(e) {}
            }
          }
          break; // 最初に見つかったA社のフォーマットを使用
        }
      }
    }
    
    // 4. A社データの再標準化
    const standardizedRows = [];
    const tz = ss.getSpreadsheetTimeZone();
    let companyName = "路線便会社A";
    const carrierSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CARRIER);
    if (carrierSheet) {
      const cData = carrierSheet.getDataRange().getValues();
      for (let i = 1; i < cData.length; i++) {
        if (cData[i][1] === companyCode) {
          companyName = cData[i][2];
          break;
        }
      }
    }
    
    let has1970Error = false;
    let hasCompanyError = false;
    
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.join("").trim() === "") continue;

      const fixedHeaders = CONFIG.STANDARDIZED_CSV_HEADERS;
      const stdRow = new Array(fixedHeaders.length).fill("");
      const stdId = IdService.generateId("STD");
      const rawId = IdService.generateId("RAW");
      
      stdRow[0] = stdId;
      stdRow[1] = rawId;
      stdRow[4] = companyCode;
      stdRow[5] = companyName;
      
      let hasError = false;
      let errorMsgs = [];
      
      let values = {};
      const sortedMapping = [...mapping].sort((a, b) => (a.joinOrder || 1) - (b.joinOrder || 1));
      
      sortedMapping.forEach(m => {
        if (m.commonField === "使用しない" || m.commonField === "") return;
        let val = row[m.originalIndex];
        if (val === null || val === undefined) val = "";
        
        if (values[m.commonField] !== undefined && values[m.commonField] !== "") {
          const sep = m.joinMethod === "半角スペース" ? " " : (m.joinMethod === "全角スペース" ? "　" : "");
          if (val !== "") values[m.commonField] += sep + val;
        } else {
          values[m.commonField] = val;
        }
      });
      
      Object.keys(values).forEach(commonField => {
        const targetIdx = fixedHeaders.indexOf(commonField);
        if (targetIdx > -1) {
          stdRow[targetIdx] = values[commonField];
        }
      });
      
      // 実績運賃の計算（再生成でもRawDataController._calcFreightを共通使用）
      if (calcMethod === "計算" && calcRuleArray.length > 0) {
        const resultObj = RawDataController._calcFreight(row, calcRuleArray);
        if (resultObj.isError) {
          hasError = true;
          errorMsgs.push(resultObj.errorMsg);
        }
        if (resultObj.value !== "") {
          stdRow[fixedHeaders.indexOf("実績運賃")] = resultObj.value;
        }
      }
      
      const shipDateIdx = fixedHeaders.indexOf("出荷日");
      const monthIdx = fixedHeaders.indexOf("対象年月");
      let shipDateVal = stdRow[shipDateIdx];
      
      if (shipDateVal) {
        try {
           let strVal = String(shipDateVal).trim();
           if (/^\d{8}$/.test(strVal)) {
             const y = strVal.substring(0, 4);
             const m = strVal.substring(4, 6);
             const d = strVal.substring(6, 8);
             stdRow[shipDateIdx] = `${y}-${m}-${d}`;
             stdRow[monthIdx] = `${y}-${m}`;
           } else {
             let d = new Date(shipDateVal);
             if (!isNaN(d.getTime())) {
               stdRow[shipDateIdx] = Utilities.formatDate(d, tz, "yyyy-MM-dd");
               stdRow[monthIdx] = Utilities.formatDate(d, tz, "yyyy-MM");
             } else if (!isNaN(Number(shipDateVal))) {
               d = new Date(Math.round((Number(shipDateVal) - 25569) * 86400 * 1000));
               if (!isNaN(d.getTime())) {
                 stdRow[shipDateIdx] = Utilities.formatDate(d, tz, "yyyy-MM-dd");
                 stdRow[monthIdx] = Utilities.formatDate(d, tz, "yyyy-MM");
               } else {
                 throw new Error();
               }
             } else {
               throw new Error();
             }
           }
        } catch(e) {
           hasError = true;
           errorMsgs.push("出荷日の形式エラー");
        }
      } else {
         hasError = true;
         errorMsgs.push("出荷日が未設定");
      }
      
      if (!stdRow[fixedHeaders.indexOf("届け先名称")]) {
         hasError = true;
         errorMsgs.push("届け先名称が未設定");
      }
      const freightVal = stdRow[fixedHeaders.indexOf("実績運賃")];
      const isBlankFreight = freightVal === "" || freightVal === null || freightVal === undefined;
      
      if (isBlankFreight && calcMethod === "直接取得") {
         hasError = true;
         errorMsgs.push("実績運賃が未設定");
      }

      const validFlagIdx = fixedHeaders.indexOf("有効フラグ");
      const errorFlagIdx = fixedHeaders.indexOf("エラー有無");
      const noteIdx = fixedHeaders.indexOf("特記事項");
      
      if (validFlagIdx > -1) stdRow[validFlagIdx] = !hasError;
      if (errorFlagIdx > -1) stdRow[errorFlagIdx] = hasError;
      if (noteIdx > -1) stdRow[noteIdx] = errorMsgs.join(", "); 
      
      // テスト自動確認
      if (String(stdRow[monthIdx]).includes("1970") || String(stdRow[shipDateIdx]).includes("1970")) {
        has1970Error = true;
      }
      if (String(stdRow[fixedHeaders.indexOf("路線便会社コード")]).includes("1970") ||
          String(stdRow[fixedHeaders.indexOf("路線便会社名")]).includes("1970")) {
        hasCompanyError = true;
      }
      
      standardizedRows.push(stdRow);
    }
    
    if (standardizedRows.length > 0) {
      const fixedHeaders = CONFIG.STANDARDIZED_CSV_HEADERS;
      sheet.getRange(2, 1, standardizedRows.length, fixedHeaders.length).setValues(standardizedRows);
    }
    
    // 6. 結果の確認とログ保存
    const finalCols = sheet.getLastColumn();
    const finalHeader = sheet.getRange(1, 1, 1, finalCols > 0 ? finalCols : 1).getValues()[0].join(",");
    const expectedHeader = headers.join(",");
    
    const isExpectedCols = (finalCols === headers.length);
    const isHeaderCorrect = (finalHeader === expectedHeader);
    
    if (isExpectedCols && isHeaderCorrect && !has1970Error && !hasCompanyError && standardizedRows.length > 0) {
      ui.alert("再生成完了", 
        "23_標準化出荷データの再生成が完了しました。\n\n" +
        "列数：" + headers.length + "列\n" +
        "A社保存件数：" + standardizedRows.length + "件\n" +
        "1970年エラー：0件\n" +
        "会社情報エラー：0件", 
        ui.ButtonSet.OK);
    } else {
      let errorMsg = "再生成失敗\n\n原因:\n";
      if (!isExpectedCols) errorMsg += "・列数が" + headers.length + "列ではありません（" + finalCols + "列）。\n";
      if (!isHeaderCorrect) errorMsg += "・ヘッダー構成が正式仕様と一致しません。\n";
      if (standardizedRows.length === 0) errorMsg += "・A社データが保存されませんでした。\n";
      if (has1970Error) errorMsg += "・対象年月または出荷日に1970-01が存在します。\n";
      if (hasCompanyError) errorMsg += "・路線便会社コードまたは会社名に日付が混入しています。\n";
      
      ui.alert("エラー", errorMsg, ui.ButtonSet.OK);
    }
    
  } catch(e) {
    ui.alert("再生成失敗", "原因:\n" + e.message, ui.ButtonSet.OK);
  }
}
