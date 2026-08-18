/**
 * SheetManager.gs
 * シート管理・データ入出力処理
 */

const SheetManager = {
  // 必須シート定義
  REQUIRED_SHEETS: {
    '00_システム設定': [
      ['設定キー', '設定値', '説明', '更新日', '更新者'],
      ['一時ファイル保存先フォルダID', '', 'Drive APIで変換する際の一時保存先', '', ''],
      ['一時ファイル保持期限(日)', '1', 'この日数を過ぎた一時ファイルは削除', '', ''],
      ['最終清掃日時', '', '自動清掃が実行された日時', '', ''],
      ['CSV出力先GoogleドライブフォルダID', '', '指定がない場合はエラー停止します', '', ''],
      ['CSV出力先フォルダ名', '路線便運賃分析_CSV', '新規作成時のフォルダ名', '', '']
    ],
    '01_路線会社マスタ': [
      ['路線便会社コード', '路線便会社名', '表示名', '分析元区分', '標準化データスプレッドシートID', '標準化データシート名', '貼付用シート名', '有効フラグ', '分析対象初期値', '変更候補対象フラグ', '表示順', '備考', '登録日', '更新日']
    ],
    '02_分析条件': [
      ['分析ID', '対象期間', '比較期間', '選択路線会社数', '変更候補検索範囲', '実行者', '最終更新日時']
    ],
    '03_分析対象路線会社': [
      ['分析ID', '路線便会社コード', '選択フラグ', '登録日時']
    ],
    '04_分析用データ': [
      ['分析用データID', '原本データID', '対象年月', '出荷日', '路線便会社コード', '路線便会社名', '出荷元コード', '出荷元名', '届け先コード', '届け先名称', '届け先郵便番号', '届け先住所', '都道府県', '市区町村', '個数', '重量', 'サイズ', '実績運賃', '有効フラグ', 'エラー有無', '管理番号', '特記事項', '更新処理ID', '更新状態', '更新開始日時']
    ],
    '05_出荷元マスタ': [
      ['出荷元コード', '出荷元名', '初回出荷日', '最終出荷日', '有効フラグ', '登録日', '更新日', '備考']
    ],
    '06_届け先マスタ': [
      ['届け先ID', '出荷元コード', '届け先コード', '暫定届け先キー', '統一届け先名称', '届け先郵便番号', '届け先住所', '都道府県', '市区町村', '初回出荷日', '最終出荷日', '有効フラグ', '登録日', '更新日', '備考']
    ],
    '12_標準化データ取込履歴': [
      ['取込ID', '路線便会社コード', '路線便会社名', '保存先標準化シート', '取込方法', '元ファイル名', '元スプレッドシートID', '元シート名', '読込件数', '新規登録件数', '重複除外件数', 'エラー件数', '実行者', '開始日時', '終了日時', '処理結果', '備考']
    ],
    '20_全体分析': [
      ['分析ID', '対象期間', '比較期間', '対象路線会社数', '全取得件数', '有効出荷件数', '運賃計算対象件数', '運賃欠損件数', '個数欠損件数', '重量欠損件数', 'エラーデータ件数', '総実績運賃', '総個数', '総重量', '1件当たり平均運賃', '1個当たり平均運賃', '1kg当たり平均運賃', '比較期間総実績運賃', '総実績運賃差', '出荷件数差', '1件当たり平均運賃差', '総個数差', '総重量差', '最終分析日時']
    ],
    '21_路線会社別分析': [
      ['分析ID', '路線便会社コード', '路線便会社名', '総実績運賃', '有効出荷件数', '総個数', '総重量', '1件当たり平均運賃', '1個当たり平均運賃', '1kg当たり平均運賃', '比較期間との差', '使用届け先数']
    ],
    '23_届け先別分析': [
      ['分析ID', '届け先ID', '届け先コード', '届け先名称', '届け先郵便番号', '届け先住所', '都道府県', '市区町村', '総実績運賃', '有効出荷件数', '総個数', '総重量', '1件当たり平均運賃', '使用路線会社数', '使用路線会社', '比較期間との差']
    ],
    '40_分析実行履歴': [
      ['分析ID', '対象期間', '比較期間', '対象路線会社数', '全取得件数', '有効出荷件数', 'エラーデータ件数', '対象出荷元数', '対象届け先数', '新規出荷元数', '新規届け先数', '実行者', '実行開始日時', '実行終了日時', '実行時間', '実行結果']
    ],
    '41_CSV出力履歴': [
      ['出力ID', '出力対象', '出力条件', '出力件数', 'ファイル名', '実行者', '出力日時', '処理結果']
    ],
    '42_エラーログ': [
      ['エラーID', '分析ID', '処理名', '関数名', '原本データID', 'エラー区分', 'エラー内容', '対象データ', '発生日時', '対応状況', '対応内容']
    ]
  },

  /**
   * 初期セットアップ（必須シートの作成）
   */
  setup: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    for (const [sheetName, initialData] of Object.entries(this.REQUIRED_SHEETS)) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, initialData.length, initialData[0].length).setValues(initialData);
        sheet.setFrozenRows(1); // ヘッダー固定
      }
    }
  },

  /**
   * 路線会社マスタから有効な路線会社一覧を取得
   */
  getActiveRouteCompanies: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('01_路線会社マスタ');
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    
    const codeIdx = headers.indexOf('路線便会社コード');
    const nameIdx = headers.indexOf('路線便会社名');
    const sourceIdx = headers.indexOf('分析元区分');
    const ssIdIdx = headers.indexOf('標準化データスプレッドシートID');
    const sheetNameIdx = headers.indexOf('標準化データシート名');
    const pasteSheetIdx = headers.indexOf('貼付用シート名');
    const validIdx = headers.indexOf('有効フラグ');
    const initIdx = headers.indexOf('分析対象初期値');
    
    const companies = [];
    for (let i = 1; i < data.length; i++) {
      if (Utils.isValidFlag(data[i][validIdx])) {
        companies.push({
          code: data[i][codeIdx],
          name: data[i][nameIdx],
          sourceType: data[i][sourceIdx],
          ssId: data[i][ssIdIdx],
          sheetName: data[i][sheetNameIdx],
          pasteSheetName: data[i][pasteSheetIdx],
          initialSelect: Utils.isValidFlag(data[i][initIdx])
        });
      }
    }
    return companies;
  },

  /**
   * 会社別の保存先シートおよび貼付シートの存在を確認し、なければ作成する
   */
  ensureCompanySheets: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const companies = this.getActiveRouteCompanies();
    
    const stdHeaders = [
      '標準化データID', '原本データID', '対象年月', '出荷日', 
      '路線便会社コード', '路線便会社名', '出荷元コード', '出荷元名',
      '届け先コード', '届け先名称', '届け先郵便番号', '届け先住所',
      '都道府県', '市区町村', '個数', '重量', 'サイズ', '実績運賃',
      '管理番号', '有効フラグ', 'エラー有無', '特記事項'
    ];

    companies.forEach(company => {
      // 内部シート保存方式の場合、シートがなければ作成
      if (company.sourceType === 'アプリ3内シート' && company.sheetName) {
        let sheet = ss.getSheetByName(company.sheetName);
        if (!sheet) {
          sheet = ss.insertSheet(company.sheetName);
          sheet.getRange(1, 1, 1, stdHeaders.length).setValues([stdHeaders]);
          sheet.setFrozenRows(1);
        }
      }
      
      // 貼付用シートが指定されていて存在しなければ作成
      if (company.pasteSheetName) {
        let pSheet = ss.getSheetByName(company.pasteSheetName);
        if (!pSheet) {
          pSheet = ss.insertSheet(company.pasteSheetName);
          pSheet.getRange(1, 1, 1, stdHeaders.length).setValues([stdHeaders]);
          pSheet.setFrozenRows(1);
        }
      }
    });
  },

  /**
   * エラーをログに記録
   */
  logError: function(analysisId, processName, functionName, originalDataId, errorType, content, targetData) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('42_エラーログ');
      if (sheet) {
        const errorId = Utils.generateUUID();
        const now = new Date();
        const dataStr = targetData ? JSON.stringify(targetData).substring(0, 500) : '';
        sheet.appendRow([
          errorId, analysisId, processName, functionName, originalDataId, 
          errorType, content, dataStr, now, '未対応', ''
        ]);
      }
    } catch(e) {
      // ログ記録の失敗は無視
    }
  },

  /**
   * 処理履歴などを保存する汎用関数
   */
  appendRowToSheet: function(sheetName, rowData) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      sheet.appendRow(rowData);
    }
  },

  /**
   * 一時シートを用いて安全に結果を書き込む (トランザクション処理)
   */
  safeWriteToSheet: function(targetSheetName, analysisId, newValues) {
    if (!newValues || newValues.length === 0) return;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tempSheetName = `temp_${targetSheetName}_${analysisId}`;
    let tempSheet = ss.getSheetByName(tempSheetName);
    if (tempSheet) ss.deleteSheet(tempSheet);
    
    tempSheet = ss.insertSheet(tempSheetName);
    tempSheet.getRange(1, 1, newValues.length, newValues[0].length).setValues(newValues);
    
    const writtenData = tempSheet.getDataRange().getValues();
    if (writtenData.length !== newValues.length || writtenData[0].length !== newValues[0].length) {
      ss.deleteSheet(tempSheet);
      throw new Error(`[${targetSheetName}] 一時シートへの書き込み検証に失敗しました。`);
    }
    
    Utils.withLock(() => {
      let targetSheet = ss.getSheetByName(targetSheetName);
      if (!targetSheet) targetSheet = ss.insertSheet(targetSheetName);
      
      const oldValues = targetSheet.getDataRange().getValues();
      
      try {
        targetSheet.clear();
        targetSheet.getRange(1, 1, newValues.length, newValues[0].length).setValues(newValues);
      } catch (e) {
        if (oldValues.length > 0) {
          try {
            targetSheet.clear();
            targetSheet.getRange(1, 1, oldValues.length, oldValues[0].length).setValues(oldValues);
          } catch(restoreErr) {
            this.logError(analysisId, '安全な入れ替え', 'safeWriteToSheet', '', 'シート破損', `復元失敗: ${targetSheetName}`, e.message);
            throw new Error(`更新中に致命的なエラーが発生し、復元にも失敗しました: ${targetSheetName}`);
          }
        }
        throw new Error(`シート更新に失敗したため、前回状態を復元しました: ${targetSheetName}`);
      }
      ss.deleteSheet(tempSheet);
    });
  }
};
