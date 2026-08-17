/**
 * Webアプリケーションから呼び出される取込コントローラ
 */
class ImportController {

  /**
   * 画面初期表示用のマスタデータ（会社一覧等）を取得します
   */
  static getInitialData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 26_契約プロファイル設定の自動作成・ヘッダー更新（Phase2暫定）
    let profileSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_PROFILE);
    const headers = CONFIG.HEADERS[CONFIG.SHEET_NAMES.CONTRACT_PROFILE];
    if (!profileSheet) {
      profileSheet = ss.insertSheet(CONFIG.SHEET_NAMES.CONTRACT_PROFILE);
      profileSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      const existingHeaders = profileSheet.getRange(1, 1, 1, profileSheet.getLastColumn() || 1).getValues()[0];
      if (profileSheet.getLastRow() <= 1 && existingHeaders.length !== headers.length) {
        profileSheet.clearContents();
        profileSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else if (profileSheet.getLastRow() > 1 && existingHeaders.length !== headers.length) {
        console.warn("26_契約プロファイル設定に既にデータが存在しますが、列構成が古い可能性があります。");
      }
    }

    const carrierSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CARRIER);
    const carriers = [];
    
    if (carrierSheet && carrierSheet.getLastRow() > 1) {
      const data = carrierSheet.getRange(2, 2, carrierSheet.getLastRow() - 1, 2).getValues();
      data.forEach(row => {
        if (row[0] && row[1]) {
          carriers.push({ code: row[0], name: row[1] });
        }
      });
    }
    
    // 既存シートの取得（システム管理用シート以外でデータがあるシート）
    const existingSheets = [];
    const allSheets = ss.getSheets();
    
    // システム管理用・履歴・マスタ等の除外対象シート名リスト
    const systemSheetNames = new Set(Object.values(CONFIG.SHEET_NAMES).filter(name => {
      // 原本貼付シート（18〜21）は取り込み対象として残す
      if (name.includes("原本貼付")) return false;
      return true;
    }));
    
    allSheets.forEach(sheet => {
      const sName = sheet.getName();
      // システム管理系シートでなく、かつデータが存在する(1行以上ある)シートを候補とする
      if (!systemSheetNames.has(sName) && sheet.getLastRow() > 0) {
        existingSheets.push({
          sheetName: sName,
          companyCode: ""
        });
      }
    });
    
    return {
      carriers: carriers,
      commonFields: CONFIG.MAPPABLE_FIELDS,
      requiredFields: CONFIG.MAPPING_REQUIRED_FIELDS,
      existingSheets: existingSheets,
      realValues: typeof getImportRealValues === 'function' ? getImportRealValues() : null
    };
  }

  /**
   * アップロードされたファイルを解析し、自動予測結果を返します。
   */
  static processFile(formObject) {
    try {
      const fileBlob = formObject.file;
      const fileName = fileBlob.getName();
      const companyCode = formObject.companyCode;
      
      if (!companyCode) throw new Error("路線便会社が選択されていません。");
      if (!fileBlob || fileBlob.getBytes().length === 0) throw new Error("ファイルが空です。");
      
      // FileParserでデータを取得
      const data = FileParser.parseFile(fileBlob, fileName);
      if (data.length === 0) throw new Error("ファイルにデータが存在しません。");
      
      const headers = data[0];
      const formatSignature = MappingPredictor.generateSignature(headers);
      
      // 自動予測
      const predictionResult = MappingPredictor.predictMapping(companyCode, headers, formatSignature);
      
      // プレビュー用に最初の10行を取得
      const sampleData = data.slice(1, 11);
      
      // 一時保存用キャッシュにデータ全体を保存する（ファイルが大きい場合は分割も検討）
      const cacheId = Utilities.getUuid();
      const cache = CacheService.getUserCache();
      // ※ここではデモとして100KBごとに分割するか、簡易的に1000行程度を保存
      // 実際の運用ではDriveに一時保存するなどの工夫が必要ですが、要件上まずはインメモリで処理
      // 今回は一旦そのままメモリから返すか、フロント側で保持させる
      
      return {
        success: true,
        fileName: fileName,
        formatSignature: formatSignature,
        isExactMatch: predictionResult.isExactMatch,
        predictions: predictionResult.predictions,
        calcMethod: predictionResult.calcMethod,
        calcRule: predictionResult.calcRule,
        contractProfiles: predictionResult.contractProfiles,
        defaultProfileId: predictionResult.defaultProfileId,
        defaultSurchargeHandling: predictionResult.defaultSurchargeHandling,
        sampleData: sampleData,
        // データ全体をフロントに返し、マッピング確定時に送り返してもらう（GASのタイムアウト対策）
        // ただし大きすぎる場合はエラーになるため、本来はDrive一時保存推奨。今回はプロトタイプとして配列で返す。
        rawData: data
      };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * マッピングを確定し、標準化処理を実行します。
   */
  static saveMappingAndStandardize(payload) {
    try {
      return RawDataController.processStandardization(payload);
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
  /**
   * 既存シートを解析し、自動予測結果を返します。
   */
  static processExistingSheet(sheetName, companyCode) {
    try {
      if (!companyCode) throw new Error("路線便会社が選択されていません。");
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error("指定されたシートが存在しません。");
      
      if (sheet.getLastRow() === 0) throw new Error("シートにデータが存在しません。");
      
      // データ取得（Dateオブジェクトのまま返すとgoogle.script.runでエラーになるため表示文字として取得）
      const data = sheet.getDataRange().getDisplayValues();
      if (data.length === 0) throw new Error("ファイルにデータが存在しません。");
      
      const headers = data[0];
      const formatSignature = MappingPredictor.generateSignature(headers);
      
      // 自動予測
      const predictionResult = MappingPredictor.predictMapping(companyCode, headers, formatSignature);
      
      // プレビュー用に最初の10行を取得
      const sampleData = data.slice(1, 11);
      
      return {
        success: true,
        fileName: sheetName,
        formatSignature: formatSignature,
        isExactMatch: predictionResult.isExactMatch,
        predictions: predictionResult.predictions,
        calcMethod: predictionResult.calcMethod,
        calcRule: predictionResult.calcRule,
        contractProfiles: predictionResult.contractProfiles,
        defaultProfileId: predictionResult.defaultProfileId,
        defaultSurchargeHandling: predictionResult.defaultSurchargeHandling,
        sampleData: sampleData,
        rawData: data
      };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
}

// =====================================
// フロントエンド呼び出し用公開関数
// =====================================
function apiGetInitialData() { return ImportController.getInitialData(); }
function apiProcessFile(formObject) { return ImportController.processFile(formObject); }
function apiProcessExistingSheet(sheetName, companyCode) { return ImportController.processExistingSheet(sheetName, companyCode); }
function apiSaveMappingAndStandardize(payload) { return ImportController.saveMappingAndStandardize(payload); }
function apiGenerateCsv(companyCode, targetMonth) { return CsvExportService.generateCsv(companyCode, targetMonth); }
function apiPreviewCalcFreight(rows, calcRuleArray) { return rows.map(r => RawDataController._calcFreight(r, calcRuleArray)); }
