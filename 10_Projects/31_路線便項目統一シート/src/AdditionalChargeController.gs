/**
 * 期間追加料金を登録するためのコントローラー
 */
class AdditionalChargeController {
  
  /**
   * 追加料金登録ダイアログを表示します。
   */
  static showDialog() {
    const html = HtmlService.createTemplateFromFile("AdditionalChargeDialog")
      .evaluate()
      .setTitle("期間追加料金を登録")
      .setWidth(600)
      .setHeight(800);
    SpreadsheetApp.getUi().showModalDialog(html, "期間追加料金を登録");
  }

  /**
   * 26_契約プロファイル設定から有効なプロファイルのリストを取得します（UI描画用）
   */
  static getValidContractProfiles() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_PROFILE);
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const idxId = headers.indexOf("契約プロファイルID");
    const idxName = headers.indexOf("契約プロファイル名");
    const idxCarrierCode = headers.indexOf("路線便会社コード");
    const idxCarrierName = headers.indexOf("路線便会社名");
    const idxIdentifier = headers.indexOf("荷主・契約識別情報");
    const idxHandling = headers.indexOf("サーチャージ取扱区分");
    const idxValid = headers.indexOf("有効フラグ");
    
    const profiles = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (this._isValidFlag(row[idxValid])) {
        profiles.push({
          id: row[idxId],
          name: row[idxName],
          carrierCode: row[idxCarrierCode],
          carrierName: row[idxCarrierName],
          identifier: row[idxIdentifier],
          handling: row[idxHandling]
        });
      }
    }
    return profiles;
  }

  /**
   * 既存システムと統一した柔軟な有効フラグ判定
   */
  static _isValidFlag(val) {
    if (val === true || val === 1) return true;
    if (typeof val === "string") {
      const s = val.trim().toUpperCase();
      return s === "TRUE" || s === "1" || s === "○" || s === "有効";
    }
    return false;
  }

  /**
   * 期間追加料金を25_標準化追加料金データへ保存します。
   */
  static saveAdditionalCharge(payload) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      
      // 1. 契約プロファイルの再照合
      const profileSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_PROFILE);
      if (!profileSheet) throw new Error("契約プロファイル設定シートが存在しません。");
      
      const pData = profileSheet.getDataRange().getValues();
      const pHeaders = pData[0];
      const pIdxId = pHeaders.indexOf("契約プロファイルID");
      const pIdxCarrierCode = pHeaders.indexOf("路線便会社コード");
      const pIdxCarrierName = pHeaders.indexOf("路線便会社名");
      const pIdxIdentifier = pHeaders.indexOf("荷主・契約識別情報");
      const pIdxHandling = pHeaders.indexOf("サーチャージ取扱区分");
      const pIdxValid = pHeaders.indexOf("有効フラグ");
      
      let matchedProfile = null;
      for (let i = 1; i < pData.length; i++) {
        if (pData[i][pIdxId] === payload.profileId && this._isValidFlag(pData[i][pIdxValid])) {
          matchedProfile = pData[i];
          break;
        }
      }
      
      if (!matchedProfile) throw new Error("指定された契約プロファイルが無効または存在しません。");
      if (matchedProfile[pIdxHandling] !== "PERIOD_SEPARATE") {
        throw new Error("この契約プロファイルは期間合計料金の設定ではありません。");
      }
      
      // 2. GAS側再検証
      if (!/^\d{4}-\d{2}$/.test(payload.targetMonth)) {
        throw new Error("対象年月は YYYY-MM の形式で入力してください。");
      }
      
      const rawAmount = String(payload.amount).trim();
      if (!rawAmount) throw new Error("金額を入力してください。");
      
      const cleanedAmount = rawAmount.replace(/,/g, '').replace(/円/g, '').trim();
      const amount = Number(cleanedAmount);
      if (isNaN(amount) || cleanedAmount === "") throw new Error("金額を数値として読み取れません。");
      
      if (payload.startDate && payload.endDate && payload.startDate > payload.endDate) {
        throw new Error("対象開始日は対象終了日以前を指定してください。");
      }
      
      // 3. 重複判定
      const addChargeSheetName = CONFIG.SHEET_NAMES.ADDITIONAL_CHARGE;
      let addChargeSheet = ss.getSheetByName(addChargeSheetName);
      if (!addChargeSheet) throw new Error("25_標準化追加料金データが存在しません。更新メニューを実行してください。");
      
      const acHeaders = CONFIG.HEADERS[addChargeSheetName];
      if (acHeaders.length < 16) throw new Error("25シートのヘッダー定義が16列ではありません。");
      
      const acData = addChargeSheet.getDataRange().getValues();
      if (acData.length > 1) {
        const cIdxProfileId = acHeaders.indexOf("契約プロファイルID");
        const cIdxMonth = acHeaders.indexOf("対象年月");
        const cIdxStart = acHeaders.indexOf("対象開始日");
        const cIdxEnd = acHeaders.indexOf("対象終了日");
        const cIdxType = acHeaders.indexOf("料金種別");
        const cIdxOrig = acHeaders.indexOf("元項目名");
        const cIdxAmount = acHeaders.indexOf("金額");
        
        const normalizedPayloadMonth = this._normalizeMonth(payload.targetMonth);
        const normalizedPayloadStart = this._normalizeDate(payload.startDate);
        const normalizedPayloadEnd = this._normalizeDate(payload.endDate);
        const normalizedPayloadType = String(payload.chargeType || "").trim();
        const normalizedPayloadOrig = String(payload.originalItemName || "").trim();
        const payloadProfileId = String(payload.profileId).trim();

        for (let i = 1; i < acData.length; i++) {
          const row = acData[i];
          if (String(row[cIdxProfileId]).trim() === payloadProfileId &&
              this._normalizeMonth(row[cIdxMonth]) === normalizedPayloadMonth &&
              this._normalizeDate(row[cIdxStart]) === normalizedPayloadStart &&
              this._normalizeDate(row[cIdxEnd]) === normalizedPayloadEnd &&
              String(row[cIdxType] || "").trim() === normalizedPayloadType &&
              String(row[cIdxOrig] || "").trim() === normalizedPayloadOrig &&
              Number(row[cIdxAmount]) === amount) {
            throw new Error("同一内容の期間追加料金が既に登録されています。");
          }
        }
      }
      
      // 4. 取込履歴作成
      const historySheet = ss.getSheetByName(CONFIG.SHEET_NAMES.HISTORY);
      if (!historySheet) throw new Error("取込履歴シートが存在しません。");
      const hHeaders = CONFIG.HEADERS[CONFIG.SHEET_NAMES.HISTORY];
      const historyId = IdService.generateId(CONFIG.ID_PREFIX[CONFIG.SHEET_NAMES.HISTORY] || "IMP");
      const now = new Date();
      
      const newHistoryRow = new Array(hHeaders.length).fill("");
      newHistoryRow[hHeaders.indexOf("取込ID")] = historyId;
      newHistoryRow[hHeaders.indexOf("取込日時")] = now;
      newHistoryRow[hHeaders.indexOf("路線便会社コード")] = matchedProfile[pIdxCarrierCode];
      newHistoryRow[hHeaders.indexOf("路線便会社名")] = matchedProfile[pIdxCarrierName];
      newHistoryRow[hHeaders.indexOf("操作種類")] = "期間追加料金手入力";
      newHistoryRow[hHeaders.indexOf("登録件数")] = 1;
      newHistoryRow[hHeaders.indexOf("実行ユーザー")] = Session.getActiveUser().getEmail();
      newHistoryRow[hHeaders.indexOf("結果")] = "完了";
      newHistoryRow[hHeaders.indexOf("開始日時")] = now;
      newHistoryRow[hHeaders.indexOf("終了日時")] = now;
      
      // 5. 25シート保存
      const addChargeId = IdService.generateId(CONFIG.ID_PREFIX[addChargeSheetName] || "ADC");
      const newChargeRow = new Array(acHeaders.length).fill("");
      
      newChargeRow[acHeaders.indexOf("追加料金データID")] = addChargeId;
      newChargeRow[acHeaders.indexOf("契約プロファイルID")] = payload.profileId;
      newChargeRow[acHeaders.indexOf("路線便会社コード")] = matchedProfile[pIdxCarrierCode];
      newChargeRow[acHeaders.indexOf("路線便会社名")] = matchedProfile[pIdxCarrierName];
      newChargeRow[acHeaders.indexOf("対象年月")] = payload.targetMonth;
      newChargeRow[acHeaders.indexOf("対象開始日")] = payload.startDate || "";
      newChargeRow[acHeaders.indexOf("対象終了日")] = payload.endDate || "";
      newChargeRow[acHeaders.indexOf("料金種別")] = payload.chargeType;
      newChargeRow[acHeaders.indexOf("元項目名")] = payload.originalItemName || "";
      newChargeRow[acHeaders.indexOf("金額")] = amount;
      newChargeRow[acHeaders.indexOf("集計単位")] = payload.aggregateUnit || "";
      newChargeRow[acHeaders.indexOf("実績運賃への包含状態")] = "PERIOD_SEPARATE";
      newChargeRow[acHeaders.indexOf("荷主・契約識別情報")] = matchedProfile[pIdxIdentifier];
      newChargeRow[acHeaders.indexOf("取込ID")] = historyId;
      newChargeRow[acHeaders.indexOf("取込フォーマットID")] = ""; // 手入力は原則空白
      newChargeRow[acHeaders.indexOf("備考")] = payload.note || "";
      
      // 保存実行（安全な順序: 検証完了 -> 履歴保存 -> 追加料金保存）
      historySheet.appendRow(newHistoryRow);
      addChargeSheet.appendRow(newChargeRow);
      
      return { success: true, message: "期間追加料金を登録しました。", newId: addChargeId };
      
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * 対象年月をYYYY-MM形式に正規化します。
   */
  static _normalizeMonth(val) {
    if (val === null || val === undefined || val === "") return "";
    if (val instanceof Date) {
      return Utilities.formatDate(val, Session.getScriptTimeZone() || "Asia/Tokyo", "yyyy-MM");
    }
    return String(val).trim().replace(/\//g, "-");
  }

  /**
   * 日付をYYYY-MM-DD形式等、比較可能な形式に正規化します。
   */
  static _normalizeDate(val) {
    if (val === null || val === undefined || val === "") return "";
    if (val instanceof Date) {
      return Utilities.formatDate(val, Session.getScriptTimeZone() || "Asia/Tokyo", "yyyy-MM-dd");
    }
    return String(val).trim().replace(/\//g, "-");
  }
}
