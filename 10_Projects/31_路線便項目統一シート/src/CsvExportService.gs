/**
 * 標準化CSVの出力を行うサービス
 */
class CsvExportService {
  
  /**
   * 23_標準化出荷データシートから、指定された条件でUTF-8 BOM付きのCSVデータを生成します。
   * @param {string} companyCode 路線便会社コード（空の場合は全社統合）
   * @param {string} targetMonth 対象年月（"2026-07"形式）
   * @returns {object} { filename: string, contentBase64: string }
   */
  static generateCsv(companyCode, targetMonth) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ANALYSIS_DATA);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      throw new Error("出力する標準化データが存在しません。");
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // 固定22列と列順が一致しているか確認
    const fixedHeaders = CONFIG.STANDARDIZED_CSV_HEADERS;
    let isHeaderMatch = true;
    for (let i = 0; i < fixedHeaders.length; i++) {
      if (headers[i] !== fixedHeaders[i]) {
        isHeaderMatch = false;
        break;
      }
    }
    
    if (!isHeaderMatch) {
      throw new Error("23_標準化出荷データの列構成が固定22列と一致しません。システム設定を確認してください。");
    }
    
    const companyCodeIdx = headers.indexOf("路線便会社コード");
    const targetMonthIdx = headers.indexOf("対象年月");
    const errorFlagIdx = headers.indexOf("エラー有無");
    
    const exportData = [fixedHeaders];
    let companyNameForFilename = "全路線会社";
    let hasErrorInTarget = false;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const matchCompany = !companyCode || row[companyCodeIdx] === companyCode;
      const matchMonth = !targetMonth || row[targetMonthIdx] === targetMonth;
      
      if (matchCompany && matchMonth) {
        if (errorFlagIdx > -1 && (row[errorFlagIdx] === true || String(row[errorFlagIdx]).toUpperCase() === "TRUE")) {
          hasErrorInTarget = true;
        }

        if (companyCode && exportData.length === 1) {
          // ファイル名用に会社名を保持
          const nameIdx = headers.indexOf("路線便会社名");
          if (nameIdx > -1 && row[nameIdx]) {
            companyNameForFilename = row[nameIdx];
          }
        }
        
        const formattedRow = [];
        // 固定22列分だけ出力
        for (let col = 0; col < fixedHeaders.length; col++) {
          let cell = row[col];
          if (cell instanceof Date) {
            cell = Utilities.formatDate(cell, Session.getScriptTimeZone(), "yyyy-MM-dd");
          } else if (cell === null || cell === undefined) {
            cell = ""; // 勝手に0や1を入れず空白
          }
          formattedRow.push(cell);
        }
        exportData.push(formattedRow);
      }
    }
    
    if (exportData.length <= 1) {
      throw new Error("指定された条件（" + (companyCode || "全社") + " / " + targetMonth + "）に一致するデータがありません。");
    }

    if (hasErrorInTarget) {
      throw new Error("標準化データ内に未解消のエラーが含まれています。マッピングを修正してエラーを0件にしてからCSVを出力してください。");
    }

    // CSV文字列の構築（エスケープ処理込み）
    const csvString = exportData.map(row => {
      return row.map(cell => {
        let str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(",");
    }).join("\r\n");
    
    // UTF-8 BOMを付与して文字化けを防止
    const bom = '\uFEFF';
    const finalCsv = bom + csvString;
    
    const filename = `${companyNameForFilename}_${targetMonth || "全期間"}.csv`;
    const contentBase64 = Utilities.base64Encode(Utilities.newBlob(finalCsv).getBytes());
    
    return {
      filename: filename,
      contentBase64: contentBase64
    };
  }
}
