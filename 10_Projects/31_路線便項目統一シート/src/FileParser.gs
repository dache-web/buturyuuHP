/**
 * CSVおよびXLSXの解析・抽出を行うクラス
 */
class FileParser {

  /**
   * ファイルBlobを読み込み、2次元配列のデータを返します。
   * CSVおよびXLSXに対応しています。
   * XLSXの読み込みには Drive API (Advanced Service) が必要です。
   */
  static parseFile(fileBlob, fileName) {
    const isCsv = fileName.toLowerCase().endsWith('.csv');
    const isXlsx = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');
    
    if (isCsv) {
      try {
        const csvText = fileBlob.getDataAsString('UTF-8');
        let data = Utilities.parseCsv(csvText);
        return data;
      } catch (e) {
        // UTF-8でパース失敗時はShift_JISとして再試行
        const csvText = fileBlob.getDataAsString('Shift_JIS');
        return Utilities.parseCsv(csvText);
      }
    } else if (isXlsx) {
      try {
        // Drive API を使用して一時スプレッドシートへ変換
        const resource = {
          title: "Temp_" + fileName,
          mimeType: MimeType.GOOGLE_SHEETS
        };
        const tempFile = Drive.Files.insert(resource, fileBlob);
        
        const ss = SpreadsheetApp.openById(tempFile.id);
        const sheet = ss.getSheets()[0]; // 最初のシートのみ対象
        
        let data = [];
        if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
          data = sheet.getDataRange().getValues();
        }
        
        // 一時ファイルをゴミ箱へ
        DriveApp.getFileById(tempFile.id).setTrashed(true);
        
        return data;
      } catch (e) {
        throw new Error("Excelファイルの読み込みに失敗しました。Drive APIが有効になっているか確認してください。詳細: " + e.message);
      }
    } else {
      throw new Error("サポートされていないファイル形式です。CSVまたはXLSXファイルを使用してください。");
    }
  }
}
