/**
 * システム検証サービス
 */
class ValidationService {
  
  /**
   * システムの構成（シート、ヘッダー、初期データなど）が正しく設定されているかチェックします。
   */
  static checkSystemStructure() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let warnings = 0;
    let errors = 0;
    let messages = [];

    messages.push("【システム構成チェック開始】");

    // 1. 必須シートの確認
    for (const key in CONFIG.SHEET_NAMES) {
      const sheetName = CONFIG.SHEET_NAMES[key];
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        messages.push(`[エラー] 必須シートが見つかりません: ${sheetName}`);
        errors++;
      }
    }

    if (errors > 0) {
      messages.push("シートが不足しているため、以降のチェックを中断します。初期セットアップを実行してください。");
      return ValidationService._showResult(messages, errors, warnings);
    }

    // 2. ヘッダーの確認
    for (const key in CONFIG.SHEET_NAMES) {
      const sheetName = CONFIG.SHEET_NAMES[key];
      const sheet = ss.getSheetByName(sheetName);
      const expectedHeaders = CONFIG.HEADERS[sheetName];
      
      const actualHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
      
      // 期待されるヘッダーが全て存在するか（順序も含む）チェック
      let headerError = false;
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (actualHeaders[i] !== expectedHeaders[i]) {
          headerError = true;
          break;
        }
      }
      if (headerError) {
        messages.push(`[警告] シートのヘッダーが仕様と異なります: ${sheetName}`);
        warnings++;
      }
    }

    // 3. 初期4社（路線便会社マスタ）の確認
    const carrierSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CARRIER);
    if (carrierSheet.getLastRow() > 1) {
      const carriers = carrierSheet.getRange(2, 2, carrierSheet.getLastRow() - 1, 1).getValues().flat();
      let hasAllCarriers = true;
      ["C001", "C002", "C003", "C004"].forEach(code => {
        if (carriers.indexOf(code) === -1) {
          hasAllCarriers = false;
        }
      });
      if (!hasAllCarriers) {
        messages.push(`[警告] 初期4社（C001〜C004）がすべて揃っていません。`);
        warnings++;
      }

      // 路線便会社コードの重複チェック
      const uniqueCarriers = new Set(carriers.filter(String));
      if (uniqueCarriers.size !== carriers.filter(String).length) {
        messages.push(`[エラー] 路線便会社コードに重複があります。`);
        errors++;
      }
    } else {
      messages.push(`[エラー] 路線便会社マスタにデータがありません。`);
      errors++;
    }

    // 4. 設定値の確認
    const settingSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
    if (settingSheet.getLastRow() > 1) {
      const keys = settingSheet.getRange(2, 1, settingSheet.getLastRow() - 1, 1).getValues().flat();
      if (keys.indexOf("INITIAL_CARRIER_COUNT") === -1 || keys.indexOf("TAX_DISPLAY") === -1) {
        messages.push(`[警告] 必須の設定キーが不足しています。`);
        warnings++;
      }
    } else {
      messages.push(`[エラー] 設定シートにデータがありません。`);
      errors++;
    }

    messages.push("【システム構成チェック完了】");
    ValidationService._showResult(messages, errors, warnings);
  }

  /**
   * チェック結果をダイアログとログに出力する
   */
  static _showResult(messages, errors, warnings) {
    const resultText = messages.join("\\n");
    console.log(resultText);
    
    let summary = `構成チェック完了\\nエラー: ${errors}件\\n警告: ${warnings}件\\n\\n`;
    if (errors === 0 && warnings === 0) {
      summary += "システム構成は正常です。すべての必須要件を満たしています。";
    } else {
      summary += "詳細はログまたは以下のメッセージを確認してください。\\n" + resultText;
    }
    
    SpreadsheetApp.getUi().alert("システム構成チェック", summary, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
