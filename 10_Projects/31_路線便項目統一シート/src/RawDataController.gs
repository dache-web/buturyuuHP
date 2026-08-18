/**
 * データの標準化、およびマッピングの保存を行うコントローラ
 */
class RawDataController {
  
  /**
   * 共通項目名を取得します（正規化が必要な場合はここに記述）
   */
  static _cleanCommonField(field) {
    if (!field) return "";
    return String(field).trim();
  }

  /**
   * マッピング情報を保存し、データを固定ヘッダーの標準化フォーマットへ変換して保存します。
   * @param {object} payload { companyCode, fileName, formatSignature, formatName, mapping, calcMethod, calcRule, rawData }
   */
  static processStandardization(payload) {
    const perfStart = Date.now();
    console.time("[PERF] Total Standardize Process");

    const { companyCode, fileName, formatSignature, formatName, mapping, calcMethod, calcRule, rawData, contractProfileId, contractProfileName, contractIdentifier, surchargeHandling } = payload;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const now = new Date();
    const tz = ss.getSpreadsheetTimeZone();
    const ts = Utilities.formatDate(now, tz, "yyyy/MM/dd HH:mm:ss");
    
    // 取込ID (1回の取込処理全体で共通)
    const importId = IdService.generateId(CONFIG.ID_PREFIX[CONFIG.SHEET_NAMES.IMPORT_HISTORY] || "IMP");

    // 1. 会社名の取得
    const carrierSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CARRIER);
    let companyName = "不明";
    if (carrierSheet) {
      const cData = carrierSheet.getDataRange().getValues();
      for (let i = 1; i < cData.length; i++) {
        if (cData[i][1] === companyCode) {
          companyName = cData[i][2];
          break;
        }
      }
    }

    // 10_取込履歴への親レコード作成
    const historySheet = ss.getSheetByName(CONFIG.SHEET_NAMES.HISTORY);
    let historyRowIdx = -1;
    let historyHeaders = [];
    if (historySheet) {
      historyHeaders = historySheet.getRange(1, 1, 1, Math.max(1, historySheet.getLastColumn())).getValues()[0];
      const hRow = new Array(historyHeaders.length).fill("");
      
      const setHVal = (colName, val) => {
        const idx = historyHeaders.indexOf(colName);
        if (idx !== -1) hRow[idx] = val;
      };
      
      setHVal("取込ID", importId);
      setHVal("取込日時", ts);
      setHVal("路線便会社コード", companyCode);
      setHVal("路線便会社名", companyName);
      setHVal("元ファイル名", fileName || "");
      setHVal("ファイル名", fileName || "");
      setHVal("取込対象", "出荷明細");
      setHVal("読込予定件数", rawData && rawData.length ? rawData.length - 1 : 0);
      setHVal("処理状態", "処理中");
      setHVal("現在の処理工程", "標準化処理");
      setHVal("開始日時", ts);
      setHVal("フォーマット名", formatName || "");
      
      const metaObj = {
        formatSignature: formatSignature || "",
        contractProfileId: contractProfileId || "",
        contractProfileName: contractProfileName || contractIdentifier || "",
        surchargeHandling: surchargeHandling || "UNCONFIRMED"
      };
      setHVal("備考", JSON.stringify(metaObj));
      
      historySheet.appendRow(hRow);
      historyRowIdx = historySheet.getLastRow();
    }
    
    try {
    // 2. フォーマットIDの特定
    const formatSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.FORMAT_SETTING);
    const roleSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ROLE_MASTER);
    
    let formatId = "";
    let formatRowIndex = -1;
    if (formatSheet) {
      const fData = formatSheet.getDataRange().getValues();
      for (let i = 1; i < fData.length; i++) {
        if (fData[i][1] === companyCode && fData[i][6] === formatSignature) {
          formatId = fData[i][0];
          formatRowIndex = i + 1;
          break;
        }
      }
    }
    if (!formatId) {
      formatId = IdService.generateId("FMT");
    }

    // 3. マッピングの単一値項目チェック
    const SINGLE_VALUE_FIELDS = ["出荷日", "届け先名称1", "届け先名称2", "住所1", "住所2", "住所3", "着地名称", "到着点名称", "個数", "重量", "サイズ", "管理番号"];
    const counts = {};
    const usedFieldsSet = new Set();

    mapping.forEach(m => {
      const cleanF = RawDataController._cleanCommonField(m.commonField);
      if (cleanF && cleanF !== "使用しない" && cleanF !== "未使用" && cleanF !== "-- 未選択 --") {
        counts[cleanF] = (counts[cleanF] || 0) + 1;
        usedFieldsSet.add(cleanF);
      }
    });

    for (const f of SINGLE_VALUE_FIELDS) {
      if (counts[f] > 1) {
        throw new Error(`${f}に複数の元項目が設定されています。システムでは重複マッピングが許可されていません。`);
      }
    }

    if (calcMethod === "直接取得" && counts["実績運賃"] > 1) {
      throw new Error(`実績運賃に複数の元項目が設定されています。システムでは重複マッピングが許可されていません。`);
    }
    
    // 3.5 サーチャージ項目の未設定チェック
    const hasSurchargeItem = (counts["燃料サーチャージ"] > 0 || counts["その他加算料金"] > 0);
    if (hasSurchargeItem && surchargeHandling === "UNCONFIRMED") {
      throw new Error("サーチャージの扱いが未設定です。");
    }

    // 4. マッピングの保存とmappingIdの生成
    if (roleSheet) {
      const rData = roleSheet.getDataRange().getValues();
      const newRoleRows = [rData[0]]; // ヘッダー
      
      // 今回のフォーマットID以外の既存マッピングを残す
      for (let i = 1; i < rData.length; i++) {
        if (rData[i][1] !== formatId) {
          newRoleRows.push(rData[i]);
        }
      }
      
      // 今回確定したマッピングを追加
      mapping.forEach(m => {
        m.mappingId = IdService.generateId("RLM");
        const cleanField = RawDataController._cleanCommonField(m.commonField);
        newRoleRows.push([
          m.mappingId, formatId, companyCode, m.originalName, m.originalIndex + 1, cleanField, "UI手動確定", "確定済み", "確定済み",
          m.joinGroupId || "", m.joinOrder || 1, m.joinMethod || "区切りなし", ts, ts, ""
        ]);
      });
      
      roleSheet.clearContents();
      const finalRoleRows = newRoleRows.map(row => {
        const newRow = new Array(15).fill("");
        for (let i = 0; i < 15; i++) {
          newRow[i] = row[i] !== undefined ? row[i] : "";
        }
        return newRow;
      });
      roleSheet.getRange(1, 1, finalRoleRows.length, 15).setValues(finalRoleRows);
    }
    
    // 5. 計算ルールへのmappingId注入
    let finalCalcRuleStr = calcRule || "";
    if (calcMethod === "計算" && calcRule) {
      try {
        const ruleObj = JSON.parse(calcRule);
        if (ruleObj.type === "calc" && ruleObj.fields) {
          ruleObj.fields.forEach(f => {
             const match = mapping.find(m => m.originalIndex === f.sourceIndex);
             if (match) {
               f.mappingId = match.mappingId;
             }
          });
          finalCalcRuleStr = JSON.stringify(ruleObj);
        }
      } catch(e) {}
    }
    
    // 6. フォーマット設定の保存
    if (formatSheet) {
      if (formatRowIndex > -1) {
        formatSheet.getRange(formatRowIndex, 9).setValue(ts); // 最終使用日更新
        formatSheet.getRange(formatRowIndex, 11).setValue(calcMethod || "直接取得");
        formatSheet.getRange(formatRowIndex, 12).setValue(finalCalcRuleStr);
      } else {
        const headersStr = rawData[0].join(",");
        formatSheet.appendRow([
          formatId, companyCode, companyName, formatName || fileName, 1, headersStr, formatSignature, ts, ts, true, calcMethod || "直接取得", finalCalcRuleStr
        ]);
      }
    }
    
    // 6.2 契約プロファイルの再照合
    const profileSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_PROFILE);
    if (contractProfileId && profileSheet) {
      const pData = profileSheet.getDataRange().getValues();
      let matched = false;
      let masterHandling = "";
      for (let i = 1; i < pData.length; i++) {
        if (pData[i][0] === contractProfileId && pData[i][8] === true) {
          matched = true;
          masterHandling = pData[i][6];
          break;
        }
      }
      if (matched && masterHandling !== surchargeHandling) {
        throw new Error("契約プロファイルのサーチャージ設定と今回の設定が一致しません。\n契約設定を確認してください。");
      }
    }
    
    // 6.5 契約プロファイル設定の保存
    if (profileSheet) {
      if (contractProfileId) {
        // 既存更新（最終使用日時と取扱区分を更新）
        const pData = profileSheet.getDataRange().getValues();
        for (let i = 1; i < pData.length; i++) {
          if (pData[i][0] === contractProfileId) {
            profileSheet.getRange(i + 1, 7).setValue(surchargeHandling || "UNCONFIRMED"); // 取扱区分
            profileSheet.getRange(i + 1, 8).setValue(ts); // 最終使用日時
            break;
          }
        }
      } else if (contractIdentifier || contractProfileName) {
        // 新規作成
        // ["契約プロファイルID(0)", "契約プロファイル名(1)", "路線便会社コード(2)", "路線便会社名(3)", "フォーマットID(4)", "荷主・契約識別情報(5)", "サーチャージ取扱区分(6)", "最終使用日時(7)", "有効フラグ(8)", "備考(9)"]
        const newProfileId = IdService.generateId(CONFIG.ID_PREFIX[CONFIG.SHEET_NAMES.CONTRACT_PROFILE] || "CPF");
        profileSheet.appendRow([
          newProfileId, contractProfileName || contractIdentifier, companyCode, companyName, formatId, contractIdentifier, surchargeHandling || "UNCONFIRMED", ts, true, ""
        ]);
      }
    }
    
    // 7. 標準化データの生成とSSoT保存
    const standardizedRows = [];
    const ssotRows = [];
    const errorDetails = [];
    
    // 元データのヘッダー行（推奨方式Aの headers用）
    const rawHeaders = rawData[0] || [];
    
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.join("").trim() === "") continue;

      const fixedHeaders = CONFIG.STANDARDIZED_CSV_HEADERS;
      const stdId = IdService.generateId("STD");
      const rawId = IdService.generateId("RAW");
      
      // SSoT用JSONの構築 (推奨方式A: headersとvaluesの配列で完全保持、Date型も文字列化)
      const rawValues = row.map(val => {
        if (val === null || val === undefined) return "";
        if (val instanceof Date) return Utilities.formatDate(val, tz, "yyyy-MM-dd");
        return String(val);
      });
      const rawDataJson = JSON.stringify({
        headers: rawHeaders.map(h => String(h || "")),
        values: rawValues
      });
      
      console.time("[PERF] Standardize Single Rows");
      const stdResult = RawDataController._standardizeSingleRow(
        row,
        rawId,
        stdId,
        companyCode,
        companyName,
        mapping,
        calcMethod,
        finalCalcRuleStr,
        surchargeHandling,
        tz,
        fixedHeaders,
        usedFieldsSet
      );
      console.timeEnd("[PERF] Standardize Single Rows");
      
      const stdRow = stdResult.stdRow;
      const hasError = stdResult.hasError;
      const errorMsgs = stdResult.errorMsgs;
      
      if (hasError) {
         errorDetails.push(`原本データID：${rawId}\n原因：${errorMsgs.join(", ")}`);
      }
      
      standardizedRows.push(stdRow);
      
      const ssotRow = new Array(21).fill("");
      ssotRow[0] = rawId;
      ssotRow[1] = importId;
      ssotRow[2] = companyCode;
      ssotRow[3] = companyName;
      ssotRow[4] = "出荷明細";
      ssotRow[5] = fileName;
      ssotRow[6] = "";
      ssotRow[7] = i + 1;
      ssotRow[8] = rawDataJson;
      ssotRow[9] = JSON.stringify(stdRow);
      ssotRow[10] = hasError ? "エラー" : "正常";
      ssotRow[11] = errorMsgs.join(", ");
      ssotRow[12] = hasError ? "要確認" : "確認済み";
      ssotRow[13] = !hasError;
      ssotRow[14] = ts;
      ssotRow[15] = formatId;
      ssotRow[16] = contractProfileId || "";
      ssotRow[17] = contractProfileName || contractIdentifier || "";
      ssotRow[18] = surchargeHandling || "UNCONFIRMED";
      ssotRow[19] = !hasError;
      ssotRow[20] = "";
      ssotRows.push(ssotRow);
    }
    
    // 6. 23_標準化出荷データへ保存および重複判定
    console.time("[PERF] Analysis Sheet Save");
    const analysisSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ANALYSIS_DATA);
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const finalRowsToSave = [];
    
    if (analysisSheet) {
      const existingData = analysisSheet.getDataRange().getValues();
      const existingSet = new Set();
      
      for (let i = 1; i < existingData.length; i++) {
        const row = existingData[i];
        const key = String(row[3]) + "|" + String(row[4]) + "|" + String(row[9]) + "|" + String(row[15]) + "|" + String(row[16]) + "|" + String(row[17]); 
        existingSet.add(key);
      }
      
      standardizedRows.forEach(stdRow => {
        const fixedHeaders = CONFIG.STANDARDIZED_CSV_HEADERS;
        if (stdRow[fixedHeaders.indexOf("エラー有無")] === true) {
          errorCount++;
        }
        const key = String(stdRow[3]) + "|" + String(stdRow[4]) + "|" + String(stdRow[9]) + "|" + String(stdRow[15]) + "|" + String(stdRow[16]) + "|" + String(stdRow[17]);
        if (existingSet.has(key)) {
          duplicateCount++;
        } else {
          finalRowsToSave.push(stdRow);
          existingSet.add(key);
          newCount++;
        }
      });
      
      if (finalRowsToSave.length > 0) {
        const fixedHeaders = CONFIG.STANDARDIZED_CSV_HEADERS;
        analysisSheet.getRange(analysisSheet.getLastRow() + 1, 1, finalRowsToSave.length, fixedHeaders.length).setValues(finalRowsToSave);
      }
    }
    console.timeEnd("[PERF] Analysis Sheet Save");

    let targetCompanyName = companyName;
    if (!targetCompanyName || targetCompanyName === "不明") {
      const carrierSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CARRIER);
      if (carrierSheet && carrierSheet.getLastRow() > 1) {
        const cData = carrierSheet.getDataRange().getValues();
        for (let i = 1; i < cData.length; i++) {
          if (cData[i][1] === companyCode && cData[i][2]) {
            targetCompanyName = cData[i][2];
            break;
          }
        }
      }
    }
    if (!targetCompanyName || targetCompanyName === "不明") {
      targetCompanyName = companyCode;
    }

    const timeStampStr = Utilities.formatDate(now, tz, "yyyyMMdd_HHmm");
    const companyMappingSheetName = `${targetCompanyName}_${timeStampStr}_マッピング`;
    const defSheetName = `${targetCompanyName}_${timeStampStr}_標準化定義`;

    // 6.3 会社別標準化定義シート (＜会社名＞_YYYYMMDD_HHmm_標準化定義) への設定一覧書き込み
    console.time("[PERF] Def Sheet Save");
    try {
      let defSheet = ss.getSheetByName(defSheetName);
      if (!defSheet) {
        defSheet = ss.insertSheet(defSheetName);
      } else {
        defSheet.clearContents();
      }

      const defHeaders = ["元項目名", "標準化項目名", "使用区分", "変換方法", "結合ID", "結合順", "結合方法", "計算区分", "加算・減算", "備考"];
      const defRows = [defHeaders];

      const calcRuleMap = {};
      if (calcMethod === "計算" && finalCalcRuleStr) {
        try {
          const ruleObj = JSON.parse(finalCalcRuleStr);
          if (ruleObj && ruleObj.fields) {
            ruleObj.fields.forEach(f => {
              calcRuleMap[f.sourceIndex] = f.operator || "+";
            });
          }
        } catch(e) {}
      }

      const commonFieldCounts = {};
      if (mapping && mapping.length > 0) {
        mapping.forEach(m => {
          const cleanF = RawDataController._cleanCommonField(m.commonField);
          if (cleanF && cleanF !== "使用しない" && cleanF !== "未使用" && cleanF !== "-- 未選択 --") {
            commonFieldCounts[cleanF] = (commonFieldCounts[cleanF] || 0) + 1;
          }
        });
      }

      const joinOrderTracker = {};

      if (mapping && mapping.length > 0) {
        mapping.forEach((m, idx) => {
          const origName = m.originalName || `列${idx+1}`;
          const rawField = m.uiField || m.commonField || "";
          const cleanField = RawDataController._cleanCommonField(rawField);
          const isUsed = cleanField && cleanField !== "使用しない" && cleanField !== "未使用" && cleanField !== "-- 未選択 --";

          let convertMethod = isUsed ? "単体" : "未使用";
          let joinId = "";
          let joinOrder = "";
          let joinMethod = "";
          let calcType = "";
          let calcOp = "";

          if (isUsed) {
            const isExplicitJoin = rawField.endsWith("【結合】");
            if (isExplicitJoin || commonFieldCounts[cleanField] > 1) {
              convertMethod = "結合";
              joinId = `JOIN_${cleanField}`;
              joinOrder = m.joinOrder || (joinOrderTracker[cleanField] = (joinOrderTracker[cleanField] || 0) + 1);
              joinMethod = m.joinMethod || "半角スペース";
            }

            if (calcMethod === "計算" && calcRuleMap[m.originalIndex] !== undefined) {
              convertMethod = (convertMethod === "結合") ? "結合・計算" : "計算";
              calcType = "運賃計算";
              calcOp = calcRuleMap[m.originalIndex] === "-" ? "減算 (－)" : "加算 (＋)";
            }
          }

          defRows.push([
            origName,
            isUsed ? cleanField : "",
            isUsed ? "使用" : "未使用",
            convertMethod,
            joinId,
            joinOrder,
            joinMethod,
            calcType,
            calcOp,
            ""
          ]);
        });
      }

      if (defRows.length > 0) {
        defSheet.getRange(1, 1, defRows.length, defHeaders.length).setValues(defRows);
      }
    } catch (err) {
      console.error("[DEF_SHEET_OUTPUT] ERROR", err);
    }
    console.timeEnd("[PERF] Def Sheet Save");

    // 6.4 会社別マッピングシート (＜会社名＞_YYYYMMDD_HHmm_マッピング) への成果物全件表示書き込み
    console.time("[PERF] Mapping Sheet Save");
    try {
      let mappingSheet = ss.getSheetByName(companyMappingSheetName);
      if (!mappingSheet) {
        mappingSheet = ss.insertSheet(companyMappingSheetName);
      } else {
        mappingSheet.clearContents();
      }

      const csvHeaders = CONFIG.STANDARDIZED_CSV_HEADERS;
      const mappingOutputRows = [csvHeaders].concat(standardizedRows);
      
      if (mappingOutputRows.length > 0) {
        mappingSheet.getRange(1, 1, mappingOutputRows.length, csvHeaders.length).setValues(mappingOutputRows);
      }
    } catch (err) {
      console.error("[MAPPING_OUTPUT] ERROR", err);
    }
    console.timeEnd("[PERF] Mapping Sheet Save");
    
    // 6.5 取込原本SSoT(15_取込一時データ)への保存
    console.time("[PERF] SSoT Sheet Save");
    const ssotSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TEMP_DATA);
    if (ssotSheet && ssotRows.length > 0) {
      ssotSheet.getRange(ssotSheet.getLastRow() + 1, 1, ssotRows.length, 21).setValues(ssotRows);
    }
    console.timeEnd("[PERF] SSoT Sheet Save");
    
    // 10_取込履歴の更新 (完了)
    if (historySheet && historyRowIdx > 0) {
      const endTs = Utilities.formatDate(new Date(), tz, "yyyy/MM/dd HH:mm:ss");
      const updates = {
        "処理状態": "完了",
        "結果": errorCount > 0 ? "一部エラー" : "成功",
        "処理件数": ssotRows.length,
        "登録件数": newCount,
        "エラー件数": errorCount,
        "標準化成功件数": newCount + duplicateCount,
        "終了日時": endTs
      };
      Object.keys(updates).forEach(key => {
        const idx = historyHeaders.indexOf(key);
        if (idx !== -1) {
          historySheet.getRange(historyRowIdx, idx + 1).setValue(updates[key]);
        }
      });
    }

    // 6.6 エラー0件時のみ Google Drive (「路線便_標準化CSV」) へ自動保存
    console.time("[PERF] Drive Save");
    let driveResult = null;
    if (errorCount === 0) {
      driveResult = CsvExportService.saveCsvToDrive(companyCode, null);
    }
    console.timeEnd("[PERF] Drive Save");

    console.timeEnd("[PERF] Total Standardize Process");
    console.log(`[PERF_SUMMARY] Total time: ${Date.now() - perfStart}ms`);

    let saveMessage = `保存先：\n【${companyMappingSheetName}】および 23_標準化出荷データ`;
    if (driveResult && driveResult.success) {
      saveMessage += `\nGoogle Drive保存：【${driveResult.folderName}/${driveResult.filename}】`;
    }

    return {
      success: true,
      message: `標準化が完了しました。\n\n新規：${newCount}件\n重複：${duplicateCount}件\nエラー：${errorCount}件\n\n${saveMessage}`,
      processedCount: finalRowsToSave.length,
      errorDetails: errorDetails,
      newCount: newCount,
      duplicateCount: duplicateCount,
      errorCount: errorCount,
      mappingSheetName: companyMappingSheetName,
      driveResult: driveResult
    };
    
    } catch (e) {
      // 10_取込履歴の更新 (エラー)
      if (historySheet && historyRowIdx > 0) {
        const endTs = Utilities.formatDate(new Date(), tz, "yyyy/MM/dd HH:mm:ss");
        const updates = {
          "処理状態": "エラー",
          "結果": "エラー",
          "失敗工程": "標準化処理",
          "エラー概要": String(e.message).substring(0, 500),
          "終了日時": endTs
        };
        Object.keys(updates).forEach(key => {
          const idx = historyHeaders.indexOf(key);
          if (idx !== -1) {
            historySheet.getRange(historyRowIdx, idx + 1).setValue(updates[key]);
          }
        });
      }
      throw e;
    }
  }
  
  // ▼画面側(Index.html)の計算プレビュー処理と全く同一の関数▼
  static _calcFreight(rowValues, calcRuleArray) {
    if (!calcRuleArray || calcRuleArray.length === 0) {
      return { formulaText: "対象項目なし", resultText: "空白", value: "" };
    }
    
    let total = 0;
    let hasAnyValue = false;
    let formulaParts = [];
    let hasError = false;
    let errorMsg = "";
    
    for (let i = 0; i < calcRuleArray.length; i++) {
      const rule = calcRuleArray[i];
      const rawVal = rowValues[rule.sourceIndex];
      let valStr = (rawVal === null || rawVal === undefined) ? "" : String(rawVal);
      
      valStr = valStr.replace(/[,，円\s　]/g, "");
      const opSign = rule.operator === "-" ? "－" : "＋";
      
      if (valStr === "") {
        formulaParts.push(rule.role + "(空白)");
      } else {
        const num = Number(valStr);
        if (isNaN(num)) {
          formulaParts.push(rule.role + "(エラー:" + valStr + ")");
          hasError = true;
          errorMsg = rule.sourceName + "を数値変換できません";
        } else {
          formulaParts.push(opSign + " " + rule.role + "(" + num + ")");
          hasAnyValue = true;
          if (rule.operator === "-") {
            total -= num;
          } else {
            total += num;
          }
        }
      }
    }
    
    let fText = formulaParts.join(" ");
    if (fText.startsWith("＋ ")) fText = fText.substring(2);
    
    if (hasError) {
      return { formulaText: fText, resultText: "エラー (" + errorMsg + ")", value: "", isError: true, errorMsg: errorMsg };
    }
    if (!hasAnyValue) {
      return { formulaText: fText, resultText: "空白", value: "", isError: false };
    }
    return { formulaText: fText, resultText: total + "円", value: total, isError: false };
  }

  /**
   * 1行の原本データを標準化25列に変換します。
   * @param {Array} row - 原本データ1行 (値の配列)
   * @param {String} rawId - 原本データID
   * @param {String} stdId - 標準化データID
   * @param {String} companyCode - 路線便会社コード
   * @param {String} companyName - 路線便会社名
   * @param {Array} mapping - 確定済みマッピング設定の配列
   * @param {String} calcMethod - "直接取得" または "計算"
   * @param {String} finalCalcRuleStr - 実績運賃計算ルール (JSON文字列)
   * @param {String} surchargeHandling - サーチャージ取扱区分
   * @param {String} tz - タイムゾーン
   * @param {Array} fixedHeaders - 25列のヘッダー定義
   * @returns {Object} { stdRow, hasError, errorMsgs }
   */
  static _standardizeSingleRow(
    row,
    rawId,
    stdId,
    companyCode,
    companyName,
    mapping,
    calcMethod,
    finalCalcRuleStr,
    surchargeHandling,
    tz,
    fixedHeaders,
    usedFieldsSet
  ) {
    const stdRow = new Array(fixedHeaders.length).fill("");
    stdRow[0] = stdId;
    stdRow[1] = rawId;
    stdRow[4] = companyCode;
    stdRow[5] = companyName;
    
    let hasError = false;
    let errorMsgs = [];
    
    // 元項目の抽出と結合
    let values = {};
    const sortedMapping = [...mapping].sort((a, b) => (a.joinOrder || 1) - (b.joinOrder || 1));
    
    sortedMapping.forEach(m => {
      const cleanF = RawDataController._cleanCommonField(m.commonField);
      if (!cleanF || cleanF === "使用しない" || cleanF === "未使用" || cleanF === "-- 未選択 --") return;
      
      // 計算モードの場合、「実績運賃」への直接マッピングは計算結果で指定するため結合対象外とする
      if (calcMethod === "計算" && cleanF === "実績運賃") return;

      let val = row[m.originalIndex];
      if (val === null || val === undefined) val = "";
      
      if (values[cleanF] !== undefined && values[cleanF] !== "") {
        const sep = m.joinMethod === "半角スペース" ? " " : (m.joinMethod === "全角スペース" ? "　" : "");
        if (val !== "") {
          values[cleanF] += sep + val;
        }
      } else {
        values[cleanF] = val;
      }
    });
    
    Object.keys(values).forEach(commonField => {
      const targetIdx = fixedHeaders.indexOf(commonField);
      if (targetIdx > -1) {
        stdRow[targetIdx] = values[commonField];
      }
    });
    
    // --- サーチャージ値の取得と数値変換 ---
    let rawSurchargeValStr = "";
    let surchargeSourceFound = false;
    const surchargeMapping = mapping.find(m => RawDataController._cleanCommonField(m.commonField) === "燃料サーチャージ");
    
    if (surchargeMapping) {
      surchargeSourceFound = true;
      const rawVal = row[surchargeMapping.originalIndex];
      let valStr = (rawVal === null || rawVal === undefined) ? "" : String(rawVal).trim();
      
      if (valStr !== "") {
        valStr = valStr.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
        const cleanedStr = valStr.replace(/[,，円￥\\¥\s　]/g, "");
        
        const noChargeWords = ["なし", "対象外", "非該当", "-", "－", "--", "---", "-円", "0", "0円", "ー", "―", "¥0", "￥0"];
        const unassignedWords = ["未設定", "未確認", "不明", "N/A", "n/a", "確認中"];
        
        if (noChargeWords.includes(cleanedStr) || noChargeWords.includes(valStr)) {
          valStr = "0";
        } else if (unassignedWords.includes(cleanedStr) || unassignedWords.includes(valStr)) {
          valStr = "";
        } else {
          valStr = cleanedStr;
        }
      }
      
      rawSurchargeValStr = valStr;
    }
    
    let surchargeNum = "";
    let surchargeError = false;
    if (surchargeSourceFound) {
      if (rawSurchargeValStr === "") {
        surchargeNum = "";
      } else {
        const n = Number(rawSurchargeValStr);
        if (isNaN(n)) {
          surchargeError = true;
        } else {
          surchargeNum = n;
        }
      }
    }
    
    if (surchargeError) {
       hasError = true;
       errorMsgs.push("燃料サーチャージを数値変換できません");
    }

    // --- 基礎実績運賃の計算 ---
    let baseFreight = "";
    if (calcMethod === "計算" && finalCalcRuleStr) {
       try {
         const ruleObj = JSON.parse(finalCalcRuleStr);
         if (ruleObj.type === "calc" && ruleObj.fields) {
           const filteredFields = ruleObj.fields.filter(f => {
             if (surchargeMapping && f.sourceIndex === surchargeMapping.originalIndex) return false;
             return true;
           });
           const resultObj = RawDataController._calcFreight(row, filteredFields);
           if (resultObj.isError) {
              hasError = true;
              errorMsgs.push(resultObj.errorMsg);
           }
           if (resultObj.value !== "") {
              baseFreight = resultObj.value;
           }
         }
       } catch(e) {
         hasError = true;
         errorMsgs.push("計算ルールのパースに失敗");
       }
    } else {
       const fv = stdRow[fixedHeaders.indexOf("実績運賃")];
       if (fv !== "" && fv !== null && fv !== undefined) {
          const num = Number(String(fv).replace(/[,，円\s　]/g, ""));
          if (!isNaN(num)) baseFreight = num;
          else baseFreight = fv; 
       }
    }
    
    // --- 取扱区分に基づく実績運賃と燃料サーチャージの決定 ---
    let finalFreight = baseFreight;
    let finalSurcharge = surchargeNum;
    let finalHandling = surchargeHandling;
    
    if (!surchargeError) {
       if (surchargeHandling === "NONE") {
          finalSurcharge = "";
       } else if (surchargeHandling === "INCLUDED") {
          // 加算せず取得値のみ保持
       } else if (surchargeHandling === "ADDED") {
          if (baseFreight !== "" && finalSurcharge !== "") {
             finalFreight = Number(baseFreight) + Number(finalSurcharge);
          }
       } else if (surchargeHandling === "DETAIL_SEPARATE") {
          // 加算せず取得値のみ保持
       } else if (surchargeHandling === "PERIOD_SEPARATE") {
          finalSurcharge = "";
       }
    }
    
    stdRow[fixedHeaders.indexOf("実績運賃")] = finalFreight;
    stdRow[fixedHeaders.indexOf("燃料サーチャージ")] = finalSurcharge;
    stdRow[fixedHeaders.indexOf("サーチャージ取扱区分")] = finalHandling;

    // 出荷日と対象年月の自動生成
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
    }

    const validFlagIdx = fixedHeaders.indexOf("有効フラグ");
    const errorFlagIdx = fixedHeaders.indexOf("エラー有無");
    const noteIdx = fixedHeaders.indexOf("特記事項");
    
    if (validFlagIdx > -1) stdRow[validFlagIdx] = !hasError;
    if (errorFlagIdx > -1) stdRow[errorFlagIdx] = hasError;
    if (noteIdx > -1) stdRow[noteIdx] = errorMsgs.join(", "); 
    
    return {
      stdRow: stdRow,
      hasError: hasError,
      errorMsgs: errorMsgs
    };
  }
}
