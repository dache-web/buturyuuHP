function generateSecureToken() {
  // Math.random()は使用せず、より安全なUtilities.getUuid()を2回組み合わせて64文字のHex文字列を生成します
  const uuid1 = Utilities.getUuid().replace(/-/g, ''); // 32文字
  const uuid2 = Utilities.getUuid().replace(/-/g, ''); // 32文字
  return uuid1 + uuid2;
}

/**
 * 初回セットアップ用関数
 * （既存のスプレッドシート・データが存在する場合は安全のため何もしません）
 */
function setup() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // 共有シークレットの生成と保存
  let secret = scriptProperties.getProperty('SECRET_TOKEN');
  if (!secret) {
    secret = generateSecureToken();
    scriptProperties.setProperty('SECRET_TOKEN', secret);
  }

  // 既に初期化完了している場合は停止
  let spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    throw new Error('既に初期化されています。データを破壊する可能性があるため、setup()を停止しました。強制的に再作成する場合は resetForDevelopment() を使用してください。');
  }

  // スプレッドシート作成
  const formattedDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  const ss = SpreadsheetApp.create('路線便運賃タリフマスタ_' + formattedDate);

  // シート作成とモックデータ投入
  // ※ここでエラーが起きた場合、SPREADSHEET_ID は保存されないため、
  // 次回 setup() 再実行時に「既に初期化されています」エラーでロックされることはありません。
  _createSheetsAndMockData(ss);

  // 全て正常に完了した場合のみ、最後にSPREADSHEET_IDを保存して初期化完了とする
  scriptProperties.setProperty('SPREADSHEET_ID', ss.getId());
}

/**
 * 開発用の完全再作成関数（既存データを破棄します）
 */
function resetForDevelopment() {
  // 安全装置: 誤操作を防ぐためのフラグ。実行時はここを true に手動で変更してください。
  const I_AM_SURE = false;
  
  if (!I_AM_SURE) {
    throw new Error('安全装置が作動しました。既存データが削除されるため、実行するにはコード内の I_AM_SURE フラグを true に変更してください。');
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  let spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
  
  if (!spreadsheetId) {
    throw new Error('スプレッドシートが見つかりません。初回は setup() を実行してください。');
  }
  
  const ss = SpreadsheetApp.openById(spreadsheetId);
  _createSheetsAndMockData(ss);
}

/**
 * 内部処理: シート作成とモックデータの投入
 */
function _createSheetsAndMockData(ss) {
  // シート定義
  const sheetsDef = [
    {
      name: '01_路線会社',
      headers: ['company_id', 'company_name', 'status'],
      data: [
        ['C_A', 'A路線', 'active'],
        ['C_B', 'B路線', 'active'],
        ['C_C', 'C路線', 'active'],
        ['C_D', 'D路線', 'active']
      ]
    },
    {
      name: '02_タリフ基本',
      headers: ['tariff_id', 'company_id', 'version', 'start_date', 'end_date', 'default_rounding_rule', 'vol_conversion_factor'],
      data: [
        ['T_A_2026', 'C_A', '2026年版', '2026/01/01', '2099/12/31', 'round', '280'],
        ['T_A_2025', 'C_A', '2025年版', '2025/01/01', '2025/12/31', 'round', '280'], // 旧タリフ
        ['T_B_2026', 'C_B', '2026年版', '2026/01/01', '2099/12/31', 'floor', '280'],
        ['T_C_2026', 'C_C', '2026年版', '2026/01/01', '2099/12/31', 'ceil', '280'],
        ['T_D_2026', 'C_D', '2026年版', '2026/01/01', '2099/12/31', 'round', '280']
      ]
    },
    {
      name: '03_地域定義',
      headers: ['region_id', 'tariff_id', 'prefecture', 'city', 'area_name', 'is_relay'],
      data: [
        // A路線 (新)
        ['REG_A_2026_TKY', 'T_A_2026', '東京都', '', '関東', 'FALSE'],
        ['REG_A_2026_KNG', 'T_A_2026', '神奈川県', '', '関東', 'FALSE'],
        ['REG_A_2026_OSK', 'T_A_2026', '大阪府', '', '関西', 'FALSE'],
        // A路線 (旧)
        ['REG_A_2025_TKY', 'T_A_2025', '東京都', '', '関東', 'FALSE'],
        ['REG_A_2025_OSK', 'T_A_2025', '大阪府', '', '関西', 'FALSE'],
        // B路線
        ['REG_B_2026_TKY', 'T_B_2026', '東京都', '', '東京', 'FALSE'],
        ['REG_B_2026_FUK', 'T_B_2026', '福岡県', '', '九州', 'FALSE'],
        // C路線
        ['REG_C_2026_ALL', 'T_C_2026', '*', '*', '全国共通', 'FALSE'],
        // D路線
        ['REG_D_2026_TKY', 'T_D_2026', '東京都', '', '関東', 'FALSE'],
        ['REG_D_2026_HKD', 'T_D_2026', '北海道', '', '北海道中継', 'TRUE'],
        // 例外・対象外ケース用
        ['REG_A_2026_OUT', 'T_A_2026', '沖縄県', '離島', '対象外', 'TRUE']
      ]
    },
    {
      name: '04_条件帯定義',
      headers: ['tier_id', 'tariff_id', 'condition_type', 'min_value', 'max_value'],
      data: [
        ['TIER_A_2026_10', 'T_A_2026', 'chargeable_weight', '0', '10'],
        ['TIER_A_2026_20', 'T_A_2026', 'chargeable_weight', '10.01', '20'],
        ['TIER_A_2026_30', 'T_A_2026', 'chargeable_weight', '20.01', '30'],
        ['TIER_A_2025_10', 'T_A_2025', 'chargeable_weight', '0', '10'],
        ['TIER_A_2025_20', 'T_A_2025', 'chargeable_weight', '10.01', '20'],
        ['TIER_B_2026_ALL', 'T_B_2026', 'chargeable_weight', '0', '99999'],
        ['TIER_C_2026_50', 'T_C_2026', 'chargeable_weight', '0', '50'],
        ['TIER_D_2026_100', 'T_D_2026', 'chargeable_weight', '0', '100']
      ]
    },
    {
      name: '05_運賃表',
      headers: ['record_id', 'tariff_id', 'region_from_id', 'region_to_id', 'tier_id', 'base_amount'],
      data: [
        ['REC_A_2026_01', 'T_A_2026', 'REG_A_2026_TKY', 'REG_A_2026_OSK', 'TIER_A_2026_10', '1200'],
        ['REC_A_2026_02', 'T_A_2026', 'REG_A_2026_TKY', 'REG_A_2026_OSK', 'TIER_A_2026_20', '1500'],
        ['REC_A_2026_03', 'T_A_2026', 'REG_A_2026_TKY', 'REG_A_2026_OSK', 'TIER_A_2026_30', '2000'],
        ['REC_A_2025_01', 'T_A_2025', 'REG_A_2025_TKY', 'REG_A_2025_OSK', 'TIER_A_2025_10', '1100'],
        ['REC_A_2025_02', 'T_A_2025', 'REG_A_2025_TKY', 'REG_A_2025_OSK', 'TIER_A_2025_20', '1400'],
        ['REC_B_2026_01', 'T_B_2026', 'REG_B_2026_TKY', 'REG_B_2026_FUK', 'TIER_B_2026_ALL', '800'],
        ['REC_C_2026_01', 'T_C_2026', 'REG_C_2026_ALL', 'REG_C_2026_ALL', 'TIER_C_2026_50', '3000'],
        ['REC_D_2026_01', 'T_D_2026', 'REG_D_2026_TKY', 'REG_D_2026_HKD', 'TIER_D_2026_100', '5000']
      ]
    },
    {
      name: '06_ルール基本',
      headers: ['rule_id', 'tariff_id', 'rule_name', 'group_logic', 'calculation_order', 'enabled'],
      data: [
        ['RULE_A_2026_01', 'T_A_2026', '特定条件加算', 'AND', '20', 'TRUE'],
        ['RULE_A_2026_02', 'T_A_2026', '対象外地域判定', 'AND', '5', 'TRUE'],
        ['RULE_B_2026_01', 'T_B_2026', '個数加算', 'AND', '20', 'TRUE'],
        ['RULE_C_2026_01', 'T_C_2026', '超過加算(50kg超)', 'AND', '20', 'TRUE'],
        ['RULE_C_2026_02', 'T_C_2026', '最低運賃保証', 'AND', '50', 'TRUE'],
        ['RULE_D_2026_01', 'T_D_2026', '中継料加算', 'AND', '30', 'TRUE']
      ]
    },
    {
      name: '07_ルール条件',
      headers: ['condition_id', 'rule_id', 'condition_group_id', 'logic_type', 'condition_target', 'operator', 'condition_value', 'value_type'],
      data: [
        // A路線の特定条件加算: (東京 OR 神奈川) AND 100kg以上
        ['C_A_2026_01_1', 'RULE_A_2026_01', 'GRP_1', 'OR', 'region_from', '==', '東京都', 'string'],
        ['C_A_2026_01_2', 'RULE_A_2026_01', 'GRP_1', 'OR', 'region_from', '==', '神奈川県', 'string'],
        ['C_A_2026_01_3', 'RULE_A_2026_01', 'GRP_2', 'AND', 'actual_weight', '>=', '100', 'number'],
        
        ['C_A_2026_02_1', 'RULE_A_2026_02', 'GRP_1', 'AND', 'region_to_id', '==', 'REG_A_2026_OUT', 'string'],
        ['C_B_2026_01_1', 'RULE_B_2026_01', 'GRP_1', 'AND', 'piece_count', '>=', '1', 'number'],
        ['C_C_2026_01_1', 'RULE_C_2026_01', 'GRP_1', 'AND', 'chargeable_weight', '>', '50', 'number'],
        ['C_C_2026_02_1', 'RULE_C_2026_02', 'GRP_1', 'AND', 'always', '==', 'TRUE', 'boolean'],
        ['C_D_2026_01_1', 'RULE_D_2026_01', 'GRP_1', 'AND', 'is_relay_to', '==', 'TRUE', 'boolean']
      ]
    },
    {
      name: '08_ルール処理',
      headers: ['action_id', 'rule_id', 'action_type', 'action_value', 'calculation_target', 'threshold_value', 'unit_value', 'unit_type'],
      data: [
        ['ACT_A_2026_01', 'RULE_A_2026_01', 'fixed_add', '500', 'subtotal', '', '', ''],
        ['ACT_A_2026_02', 'RULE_A_2026_02', 'exclude', '計算対象外地域です', 'all', '', '', ''],
        ['ACT_B_2026_01', 'RULE_B_2026_01', 'multiply_field_add', 'piece_count_minus_one', 'base_fare', '', '', ''],
        // C路線: 50kg超過分、1kgにつき50円加算
        ['ACT_C_2026_01', 'RULE_C_2026_01', 'excess_weight_add', '50', 'subtotal', '50', '1', 'kg'], 
        ['ACT_C_2026_02', 'RULE_C_2026_02', 'min_fare', '1500', 'final_total', '', '', ''],
        ['ACT_D_2026_01', 'RULE_D_2026_01', 'fixed_add', '800', 'subtotal', '', '', '']
      ]
    },
    {
      name: '09_テスト結果',
      headers: ['test_id', 'tariff_id', 'company_id', 'test_type', 'input_condition', 'expected_amount', 'actual_amount', 'status', 'error_message', 'executed_at', 'notes'],
      data: []
    }
  ];

  sheetsDef.forEach(def => {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    } else {
      sheet.clear(); // resetForDevelopment() 用
    }
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight("bold");
    if (def.data.length > 0) {
      sheet.getRange(2, 1, def.data.length, def.data[0].length).setValues(def.data);
    }
  });

  const defaultSheet = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
}

function doPost(e) {
  const output = { ok: false, error: 'UNKNOWN_ERROR' };
  
  try {
    const postData = JSON.parse(e.postData.contents);
    const scriptProperties = PropertiesService.getScriptProperties();
    const secret = scriptProperties.getProperty('SECRET_TOKEN');

    if (!postData.token || postData.token !== secret) {
      output.error = 'UNAUTHORIZED';
      return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
    }

    if (postData.action === 'fetchData') {
      const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const allData = {};
      
      const sheets = ss.getSheets();
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const data = sheet.getDataRange().getValues();
        const headers = data.shift();
        
        allData[sheet.getName()] = {
          headers: headers,
          rows: data
        };
      }
      
      return ContentService.createTextOutput(JSON.stringify({ ok: true, data: allData })).setMimeType(ContentService.MimeType.JSON);
    }
    
    output.error = 'INVALID_ACTION';
    
  } catch (err) {
    output.error = err.message;
  }
  
  return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * SECRET_TOKEN を安全に再生成し、上書き保存する関数
 * ※ 実行後、旧トークンは無効となります。
 * ※ 新トークンはログ等には出力されません。GASのプロジェクト設定から直接確認してください。
 */
function rotateSecretToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // 1. 新しい十分に推測困難なランダムトークンの生成 (UUIDを3つ連結)
  const newToken = Utilities.getUuid() + "-" + Utilities.getUuid() + "-" + Utilities.getUuid();
  
  // 2. SECRET_TOKEN だけを上書き（SPREADSHEET_ID等には影響しません、スプレッドシートへの変更もなし）
  scriptProperties.setProperty("SECRET_TOKEN", newToken);
  
  // 3. 完了メッセージだけを出力（トークン実値は絶対に出力しない）
  Logger.log("新しいSECRET_TOKENを生成し、スクリプトプロパティに安全に保存しました。");
  Logger.log("「プロジェクト設定」の「スクリプト プロパティ」画面から新しい値を確認してください。");
}
