/**
 * マイグレーション用の専用クラス
 */
class Migration {
  
  /**
   * 23_標準化出荷データのヘッダーを25列（v2）へ安全に更新します。
   * 既存のデータや列順は一切変更せず、X1, Y1 に追加列のヘッダーのみを書き込みます。
   */
  static migrateStandardizedDataToV2() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    
    try {
      const sheetName = CONFIG.SHEET_NAMES.ANALYSIS_DATA;
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        ui.alert("エラー", sheetName + " が存在しません。", ui.ButtonSet.OK);
        return;
      }
      
      const configHeaders = CONFIG.STANDARDIZED_CSV_HEADERS;
      if (configHeaders.length < 25) {
        throw new Error("CONFIG.STANDARDIZED_CSV_HEADERS が 25列になっていません。");
      }
      
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        throw new Error("シートにヘッダー行がありません。");
      }
      
      // 実シートのヘッダー取得
      const actualHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, 23)).getValues()[0];
      
      // 1〜23列の一致検証
      for (let i = 0; i < 23; i++) {
        if (actualHeaders[i] !== configHeaders[i]) {
          throw new Error("23_標準化出荷データの既存ヘッダーが正式仕様と一致しないため、\n自動migrationを停止しました。\n\n" +
            "位置：" + (i + 1) + "列目\n" +
            "期待：" + configHeaders[i] + "\n" +
            "実際：" + actualHeaders[i]);
        }
      }
      
      // 冪等性の確認（すでに25列対応済みか）
      if (actualHeaders[23] === "燃料サーチャージ" && actualHeaders[24] === "サーチャージ取扱区分") {
        ui.alert("確認", "すでにv2対応済みです。（ヘッダー更新不要）", ui.ButtonSet.OK);
        return;
      }
      
      // 追加列のみ更新
      sheet.getRange(1, 24).setValue("燃料サーチャージ");
      sheet.getRange(1, 25).setValue("サーチャージ取扱区分");
      
      // 背景色などの書式があれば隣に合わせる
      const bgColors = sheet.getRange(1, 1, 1, 23).getBackgrounds()[0];
      const fontWeights = sheet.getRange(1, 1, 1, 23).getFontWeights()[0];
      sheet.getRange(1, 24).setBackground(bgColors[bgColors.length - 1]).setFontWeight(fontWeights[fontWeights.length - 1]);
      sheet.getRange(1, 25).setBackground(bgColors[bgColors.length - 1]).setFontWeight(fontWeights[fontWeights.length - 1]);
      
      ui.alert("migration完了", "23_標準化出荷データのヘッダーを25列(v2仕様)へ更新しました。\n・24列目：燃料サーチャージ\n・25列目：サーチャージ取扱区分", ui.ButtonSet.OK);
      
    } catch (e) {
      ui.alert("migration失敗", e.message, ui.ButtonSet.OK);
    }
  }

  /**
   * 25_標準化追加料金データのヘッダーを16列（契約プロファイルID追加版）へ安全に更新します。
   */
  static migrateAdditionalChargeDataToV2() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    
    try {
      const sheetName = CONFIG.SHEET_NAMES.ADDITIONAL_CHARGE;
      let sheet = ss.getSheetByName(sheetName);
      
      const configHeaders = CONFIG.HEADERS[sheetName];
      if (configHeaders.length < 16) {
        throw new Error("CONFIG.HEADERS['" + sheetName + "'] が 16列になっていません。");
      }

      // シートが存在しない場合は新規作成
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, configHeaders.length).setValues([configHeaders]);
        sheet.getRange(1, 1, 1, configHeaders.length).setBackground("#f3f4f6").setFontWeight("bold");
        ui.alert("作成完了", sheetName + " が存在しなかったため新規作成し、\n正式16列ヘッダーを設定しました。", ui.ButtonSet.OK);
        return;
      }
      
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        // シートは存在するが空の場合
        sheet.getRange(1, 1, 1, configHeaders.length).setValues([configHeaders]);
        sheet.getRange(1, 1, 1, configHeaders.length).setBackground("#f3f4f6").setFontWeight("bold");
        ui.alert("作成完了", sheetName + " にヘッダーが存在しなかったため、\n正式16列ヘッダーを設定しました。", ui.ButtonSet.OK);
        return;
      }
      
      const lastRow = sheet.getLastRow();
      
      // 実シートのヘッダー取得
      const actualHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      
      // すでに16列（契約プロファイルIDが存在する）か確認
      if (actualHeaders[1] === "契約プロファイルID" && actualHeaders.length >= 16) {
        ui.alert("確認", "すでにv2（16列）対応済みです。（ヘッダー更新不要）", ui.ButtonSet.OK);
        return;
      }
      
      // データ行が存在する場合は停止
      if (lastRow > 1) {
        throw new Error("25_標準化追加料金データに実際のデータが存在するため、\n自動migrationを停止しました。\n安全のため手動で更新してください。");
      }
      
      // ヘッダーをクリアして16列をセット
      sheet.getRange(1, 1, 1, lastCol).clearContent();
      sheet.getRange(1, 1, 1, configHeaders.length).setValues([configHeaders]);
      
      // 背景色などの書式があれば1列目のものを全体に適用
      const bgColors = sheet.getRange(1, 1).getBackground();
      const fontWeights = sheet.getRange(1, 1).getFontWeight();
      sheet.getRange(1, 1, 1, configHeaders.length).setBackground(bgColors).setFontWeight(fontWeights);
      
      ui.alert("migration完了", "25_標準化追加料金データのヘッダーを16列へ更新しました。\n（「契約プロファイルID」を追加）", ui.ButtonSet.OK);
      
    } catch (e) {
      ui.alert("migration失敗", e.message, ui.ButtonSet.OK);
    }
  }

  /**
   * 15_取込一時データのヘッダーを21列（取込原本SSoT化）へ安全に更新します。
   */
  static migrateTempDataSheetToV2() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    
    try {
      const sheetName = CONFIG.SHEET_NAMES.TEMP_DATA;
      let sheet = ss.getSheetByName(sheetName);
      
      const configHeaders = CONFIG.HEADERS[sheetName];
      if (configHeaders.length < 21) {
        throw new Error(`CONFIG.HEADERS['${sheetName}'] が 21列になっていません。`);
      }

      // シートが存在しない場合は新規作成
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, configHeaders.length).setValues([configHeaders]);
        sheet.getRange(1, 1, 1, configHeaders.length).setBackground("#f3f4f6").setFontWeight("bold");
        ui.alert("作成完了", sheetName + " が存在しなかったため新規作成し、\n正式21列ヘッダーを設定しました。", ui.ButtonSet.OK);
        return;
      }
      
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        // シートは存在するが空の場合
        sheet.getRange(1, 1, 1, configHeaders.length).setValues([configHeaders]);
        sheet.getRange(1, 1, 1, configHeaders.length).setBackground("#f3f4f6").setFontWeight("bold");
        ui.alert("作成完了", sheetName + " にヘッダーが存在しなかったため、\n正式21列ヘッダーを設定しました。", ui.ButtonSet.OK);
        return;
      }
      
      // 実シートのヘッダー取得
      const actualHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, 21)).getValues()[0];
      
      // すでに21列（原本データIDが存在する）か確認
      if (actualHeaders[0] === "原本データID" && actualHeaders.length >= 21) {
        ui.alert("確認", "すでに15_取込一時データは21列対応済みです。（ヘッダー更新不要）", ui.ButtonSet.OK);
        return;
      }
      
      // 既存の1〜15列目を維持しつつ、1列目と15列目の名前を書き換え、16〜21列目を追加
      // clear() は絶対に使用しない
      sheet.getRange(1, 1).setValue("原本データID");
      sheet.getRange(1, 15).setValue("取込日時");
      
      for (let i = 15; i < 21; i++) {
        sheet.getRange(1, i + 1).setValue(configHeaders[i]);
      }
      
      // 背景色などの書式があれば1列目のものを全体に適用
      const bgColors = sheet.getRange(1, 1).getBackground();
      const fontWeights = sheet.getRange(1, 1).getFontWeight();
      sheet.getRange(1, 1, 1, 21).setBackground(bgColors).setFontWeight(fontWeights);
      
      ui.alert("migration完了", "15_取込一時データのヘッダーを21列へ更新しました。\n（既存データは保持されています）", ui.ButtonSet.OK);
      
    } catch (e) {
      ui.alert("migration失敗", e.message, ui.ButtonSet.OK);
    }
  }
}
