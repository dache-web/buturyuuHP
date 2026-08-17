/**
 * 再生成プレビュー専用コントローラ
 * 15_取込一時データから原本を読み込み、現在の設定で27シートへ再出力する
 */
class RebuildPreviewController {
  
  /**
   * プレビューダイアログ向けに15シートから取込ID一覧を取得
   */
  static getImportList() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tempSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TEMP_DATA);
    if (!tempSheet || tempSheet.getLastRow() < 2) return [];
    
    const data = tempSheet.getDataRange().getValues();
    const headers = data[0];
    
    const importIdIdx = headers.indexOf("取込ID");
    const tsIdx = headers.indexOf("取込日時");
    const compNameIdx = headers.indexOf("路線便会社名");
    const fmtIdIdx = headers.indexOf("取込フォーマットID");
    const profileNameIdx = headers.indexOf("契約プロファイル名");
    
    if (importIdIdx === -1) return [];
    
    const map = new Map();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const importId = row[importIdIdx];
      if (!importId) continue;
      
      if (!map.has(importId)) {
        const rawTs = row[tsIdx];
        const tsStr = rawTs instanceof Date
          ? Utilities.formatDate(rawTs, ss.getSpreadsheetTimeZone(), "yyyy/MM/dd HH:mm:ss")
          : String(rawTs ?? "");

        map.set(importId, {
          importId: String(importId ?? ""),
          ts: tsStr,
          companyName: String(row[compNameIdx] ?? ""),
          formatId: String(row[fmtIdIdx] ?? ""),
          profileName: String(row[profileNameIdx] ?? ""),
          count: 1
        });
      } else {
        map.get(importId).count++;
      }
    }
    
    const list = Array.from(map.values());
    list.sort((a, b) => {
      return a.ts < b.ts ? 1 : (a.ts > b.ts ? -1 : 0);
    });
    
    return list;
  }
  
  /**
   * 対象取込IDの再生成処理を実行
   */
  static executeRebuildPreview(importId) {
    if (!importId) throw new Error("取込IDが指定されていません。");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tz = ss.getSpreadsheetTimeZone();
    const now = new Date();
    const tsStr = Utilities.formatDate(now, tz, "yyyy/MM/dd HH:mm:ss");
    
    // 1. 15_取込一時データから対象レコードを抽出
    const tempSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TEMP_DATA);
    if (!tempSheet) throw new Error("15_取込一時データが存在しません。");
    
    const tempData = tempSheet.getDataRange().getValues();
    const tempHeaders = tempData[0];
    const t_importIdIdx = tempHeaders.indexOf("取込ID");
    const t_rawIdIdx = tempHeaders.indexOf("原本データID");
    const t_compCodeIdx = tempHeaders.indexOf("路線便会社コード");
    const t_compNameIdx = tempHeaders.indexOf("路線便会社名");
    const t_jsonIdx = tempHeaders.indexOf("元データJSON");
    const t_fmtIdIdx = tempHeaders.indexOf("取込フォーマットID");
    const t_profileIdIdx = tempHeaders.indexOf("契約プロファイルID");
    
    const targetRows = [];
    let formatId = null;
    let profileId = null;
    let companyCode = null;
    let companyName = null;
    
    for (let i = 1; i < tempData.length; i++) {
      if (tempData[i][t_importIdIdx] === importId) {
        targetRows.push(tempData[i]);
        const r_fmtId = tempData[i][t_fmtIdIdx];
        const r_profId = tempData[i][t_profileIdIdx];
        
        if (!r_fmtId) throw new Error("取込フォーマットIDが空のレコードが含まれています。旧データは再生成できません。");
        if (!r_profId) throw new Error("契約プロファイルIDが空のレコードが含まれています。旧データは再生成できません。");
        
        if (formatId === null) {
          formatId = r_fmtId;
          profileId = r_profId;
          companyCode = tempData[i][t_compCodeIdx];
          companyName = tempData[i][t_compNameIdx];
        } else {
          if (formatId !== r_fmtId || profileId !== r_profId) {
            throw new Error("対象の取込ID内で複数のフォーマットIDまたは契約プロファイルIDが混在しています。");
          }
        }
      }
    }
    
    if (targetRows.length === 0) throw new Error(`取込ID ${importId} のデータが見つかりません。`);
    
    // 2. 最新のフォーマット設定 (12_取込フォーマット設定) を取得
    const fmtSetting = SettingsResolver.getFormatSetting(formatId);
    if (!fmtSetting) throw new Error(`フォーマットID ${formatId} が12_取込フォーマット設定に見つかりません。`);
    const calcMethod = fmtSetting.calcMethod;
    const finalCalcRuleStr = fmtSetting.calcRule;
    
    // 3. 最新のマッピング (22_項目役割マスタ) を取得
    const mapping = SettingsResolver.getRoleMapping(formatId);
    if (!mapping || mapping.length === 0) throw new Error(`フォーマットID ${formatId} のマッピング情報が22_項目役割マスタに見つかりません。`);
    
    // 4. 最新の契約プロファイル (26_契約プロファイル設定) を取得
    const profileSetting = SettingsResolver.getContractProfile(profileId);
    if (!profileSetting) throw new Error(`契約プロファイルID ${profileId} が26_契約プロファイル設定に見つかりません。`);
    if (!profileSetting.enabled) throw new Error(`契約プロファイルID ${profileId} は無効に設定されています。`);
    const surchargeHandling = profileSetting.surchargeHandling;
    
    // 5. 23_標準化出荷データから既存の標準化データIDを取得
    const stdSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ANALYSIS_DATA);
    const existingStdIds = new Map();
    if (stdSheet && stdSheet.getLastRow() > 1) {
      const stdData = stdSheet.getDataRange().getValues();
      const s_stdIdIdx = stdData[0].indexOf("標準化データID");
      const s_rawIdIdx = stdData[0].indexOf("原本データID");
      if (s_stdIdIdx > -1 && s_rawIdIdx > -1) {
        for (let i = 1; i < stdData.length; i++) {
          existingStdIds.set(stdData[i][s_rawIdIdx], stdData[i][s_stdIdIdx]);
        }
      }
    }
    
    // 6. 再生成処理の実行
    const fixedHeaders = CONFIG.STANDARDIZED_CSV_HEADERS;
    const previewPrefix = CONFIG.ID_PREFIX[CONFIG.SHEET_NAMES.REBUILD_PREVIEW] || "RBP";
    const execId = IdService.generateId("RBX"); // 再生成実行ID
    
    const outputRows = [];
    
    for (let i = 0; i < targetRows.length; i++) {
      const tRow = targetRows[i];
      const rawId = tRow[t_rawIdIdx];
      const jsonStr = tRow[t_jsonIdx];
      let rowValues = [];
      try {
        const jsonObj = JSON.parse(jsonStr);
        rowValues = jsonObj.values || [];
      } catch (e) {
        throw new Error(`原本データID ${rawId} の元データJSONの解析に失敗しました。`);
      }
      
      const stdId = existingStdIds.get(rawId) || IdService.generateId(previewPrefix);
      
      let stdResult;
      try {
        stdResult = RawDataController._standardizeSingleRow(
          rowValues,
          rawId,
          stdId,
          companyCode,
          companyName,
          mapping,
          calcMethod,
          finalCalcRuleStr,
          surchargeHandling,
          tz,
          fixedHeaders
        );
      } catch (e) {
        stdResult = {
          stdRow: new Array(fixedHeaders.length).fill(""),
          hasError: true,
          errorMsgs: ["致命的エラー: " + e.message]
        };
        stdResult.stdRow[0] = stdId;
        stdResult.stdRow[1] = rawId;
      }
      
      const isError = stdResult.hasError;
      const errorStr = stdResult.errorMsgs ? stdResult.errorMsgs.join(", ") : "";
      
      // 管理情報7列を構築
      // ["再生成実行ID", "対象取込ID", "適用取込フォーマットID", "適用契約プロファイルID", "再生成日時", "再生成結果", "再生成エラー内容"]
      const metaRow = [
        execId,
        importId,
        formatId,
        profileId,
        tsStr,
        isError ? "エラー" : "正常",
        errorStr
      ];
      
      outputRows.push(metaRow.concat(stdResult.stdRow));
    }
    
    // 7. 27_標準化再生成プレビューシートへ出力
    const previewSheetName = CONFIG.SHEET_NAMES.REBUILD_PREVIEW;
    let previewSheet = ss.getSheetByName(previewSheetName);
    if (!previewSheet) {
      previewSheet = ss.insertSheet(previewSheetName);
    } else {
      previewSheet.clear();
    }
    
    const previewHeaders = CONFIG.HEADERS[previewSheetName];
    previewSheet.getRange(1, 1, 1, previewHeaders.length).setValues([previewHeaders]);
    previewSheet.getRange(1, 1, 1, previewHeaders.length).setBackground("#f3f4f6").setFontWeight("bold");
    
    if (outputRows.length > 0) {
      previewSheet.getRange(2, 1, outputRows.length, previewHeaders.length).setValues(outputRows);
    }
    
    return {
      success: true,
      message: `再生成プレビューが完了しました。\n対象件数: ${outputRows.length}件\n出力先: ${previewSheetName}\n※この結果は本番データ(23)には反映されていません。`
    };
  }
}
