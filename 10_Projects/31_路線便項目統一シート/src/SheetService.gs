/**
 * スプレッドシート操作サービス
 */
class SheetService {
  
  /**
   * シートを取得または新規作成します。
   * 同名シートがすでに存在する場合は削除せず、そのまま返します。
   * @param {SpreadsheetApp.Spreadsheet} ss - 対象スプレッドシート
   * @param {string} sheetName - シート名
   * @return {SpreadsheetApp.Sheet}
   */
  static getOrCreateSheet(ss, sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    return sheet;
  }

  /**
   * ヘッダー行を作成・設定します。
   * ヘッダーが未設定（A1が空）の場合にのみ書き込み、既存データを上書きしません。
   * 1行目の固定も行います。
   * @param {SpreadsheetApp.Sheet} sheet - 対象シート
   * @param {string[]} headers - ヘッダー配列
   */
  static setHeaders(sheet, headers) {
    if (!headers || headers.length === 0) return;
    
    const a1Value = sheet.getRange("A1").getValue();
    if (a1Value === "") {
      const range = sheet.getRange(1, 1, 1, headers.length);
      range.setValues([headers]);
      range.setBackground("#f3f3f3").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }

  /**
   * プルダウン（入力規則）を設定します。
   * @param {SpreadsheetApp.Sheet} sheet - 対象シート
   * @param {string[]} headers - 現在のヘッダー配列
   */
  static setValidationRules(sheet, headers) {
    for (let i = 0; i < headers.length; i++) {
      const headerName = headers[i];
      const rules = CONFIG.VALIDATION_RULES[headerName] || CONFIG.VALIDATION_RULES[headerName + "_" + sheet.getName().split("_")[1]];
      
      if (rules) {
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(rules, true)
          .build();
        // 2行目から1000行目までに設定
        sheet.getRange(2, i + 1, 999).setDataValidation(rule);
      }
    }
  }

  /**
   * チェックボックスを設定します。
   * @param {SpreadsheetApp.Sheet} sheet - 対象シート
   * @param {string[]} headers - 現在のヘッダー配列
   * @param {string[]} targetColumns - チェックボックスにするヘッダー名の配列
   */
  static setCheckboxes(sheet, headers, targetColumns) {
    if (!targetColumns) return;
    for (let i = 0; i < headers.length; i++) {
      const headerName = headers[i];
      if (targetColumns.indexOf(headerName) !== -1) {
        sheet.getRange(2, i + 1, 999).insertCheckboxes();
      }
    }
  }

  /**
   * 初期データを登録します。
   * 既にデータが入力されている場合は登録しません（2行目1列目が空かどうかで判定）。
   * @param {SpreadsheetApp.Sheet} sheet - 対象シート
   * @param {any[][]} data - 登録する2次元配列データ
   */
  static setInitialData(sheet, data) {
    if (!data || data.length === 0) return;
    const a2Value = sheet.getRange(2, 1).getValue();
    if (a2Value === "") {
      sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    }
  }

  /**
   * 列の表示形式（フォーマット）を設定します。
   * @param {SpreadsheetApp.Sheet} sheet - 対象シート
   * @param {string[]} headers - ヘッダー配列
   */
  static setColumnFormats(sheet, headers) {
    for (let i = 0; i < headers.length; i++) {
      const headerName = headers[i];
      const range = sheet.getRange(2, i + 1, 999);
      
      // 日付系項目
      if (headerName.indexOf("日") !== -1 || headerName.indexOf("日時") !== -1 || headerName === "分析年月") {
        if (headerName.indexOf("日数") === -1 && headerName.indexOf("日間") === -1 && headerName.indexOf("曜日") === -1) {
          range.setNumberFormat("yyyy/MM/dd");
          if(headerName.indexOf("日時") !== -1) {
            range.setNumberFormat("yyyy/MM/dd HH:mm:ss");
          }
        }
      }
      
      // 金額系項目
      if (headerName.indexOf("運賃") !== -1 || headerName.indexOf("金額") !== -1 || headerName.indexOf("差額") !== -1) {
        range.setNumberFormat("#,##0");
      }
      
      // 数値系項目
      if (headerName.indexOf("個数") !== -1 || headerName.indexOf("重量") !== -1 || headerName.indexOf("件数") !== -1) {
        range.setNumberFormat("#,##0.0"); // 重量などを考慮
      }
      
      // コード系（前ゼロを維持するために文字列化を推奨するが、GASだと"@"で書式設定できる）
      if (headerName.indexOf("コード") !== -1 || headerName.indexOf("郵便番号") !== -1 || headerName.indexOf("番号") !== -1) {
        range.setNumberFormat("@");
      }
    }
  }

  /**
   * 列番号を取得するユーティリティ。0始まり。
   * @param {string[]} headers - ヘッダー配列
   * @param {string} columnName - 探したい列名
   * @return {number} 列インデックス。見つからない場合は-1。
   */
  static getColumnIndex(headers, columnName) {
    return headers.indexOf(columnName);
  }
}
