/**
 * 最新の設定（12・22・26）を取得するための共通リゾルバ
 */
class SettingsResolver {
  
  /**
   * 12_取込フォーマット設定から現在設定を取得する
   */
  static getFormatSetting(formatId) {
    if (!formatId) return null;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.FORMAT_SETTING);
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    const targetId = String(formatId).trim();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] ?? "").trim() === targetId) {
        return {
          formatId: data[i][0],
          companyCode: data[i][1],
          companyName: data[i][2],
          formatSignature: data[i][6],
          calcMethod: data[i][10] || "直接取得",
          calcRule: data[i][11] || ""
        };
      }
    }
    return null;
  }
  
  /**
   * 22_項目役割マスタから現在マッピングを取得する
   */
  static getRoleMapping(formatId) {
    if (!formatId) return [];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ROLE_MASTER);
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    const targetId = String(formatId).trim();
    const mapping = [];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1] ?? "").trim() === targetId) {
        mapping.push({
          mappingId: data[i][0],
          originalName: data[i][3],
          originalIndex: Number(data[i][4]) - 1,
          commonField: data[i][5],
          joinGroupId: data[i][9],
          joinOrder: Number(data[i][10]),
          joinMethod: data[i][11]
        });
      }
    }
    return mapping;
  }
  
  /**
   * 26_契約プロファイル設定から現在プロファイルを取得する
   */
  static getContractProfile(profileId) {
    if (!profileId) return null;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_PROFILE);
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    const targetId = String(profileId).trim();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] ?? "").trim() === targetId) {
        return {
          contractProfileId: data[i][0],
          contractProfileName: data[i][1],
          companyCode: data[i][2],
          companyName: data[i][3],
          formatId: data[i][4],
          surchargeHandling: data[i][6],
          enabled: data[i][8] === true
        };
      }
    }
    return null;
  }
}
