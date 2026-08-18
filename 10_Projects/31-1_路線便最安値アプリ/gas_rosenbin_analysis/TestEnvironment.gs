/**
 * TestEnvironment.gs
 * テスト環境の全自動作成、ダミーデータ生成、既存シートの掃除を行うモジュール
 */

const TestEnvironment = {
  
  /**
   * テスト環境をすべて自動生成するメイン関数
   */
  createTestEnvironment: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. 既存シートの整理（結果シートや旧シートの削除・初期化）
    this.cleanupExistingSheets(ss);
    
    // 2. 必須管理シートの作成とヘッダー・初期値セット
    this.createManagementSheets(ss);
    
    // 3. テスト用の4社マスタ登録
    this.registerTestCompanies(ss);
    
    // 4. 4社分の標準化シート・貼付シート作成、色付け、説明追加
    this.createCompanySheets(ss);
    
    // 5. 4社分のダミーデータ（40件以上＋固定テストデータ）生成
    this.generateDummyData(ss);
    
    // 6. 出荷元・届け先マスタ等のダミーデータ生成
    this.generateMasterDummyData(ss);
  },
  
  /**
   * 既存シートの掃除
   */
  cleanupExistingSheets: function(ss) {
    const sheets = ss.getSheets();
    const keepSheets = []; // 全て作り直すため、既存シートは基本的に消す。
    // ただしGASの仕様上、最低1シートは残す必要があるため、一時シートを作って全削除後、一時シートを消す手法をとる
    const tempSheet = ss.insertSheet('TEMP_DEL_' + new Date().getTime());
    
    for (const sheet of sheets) {
      ss.deleteSheet(sheet);
    }
    
    // 一時シートの名前を「初期化中...」に変更（後で消す）
    tempSheet.setName('初期化中...');
  },
  
  /**
   * 全管理シートを作成し、ヘッダーを入れる
   */
  createManagementSheets: function(ss) {
    const requiredSheets = SheetManager.REQUIRED_SHEETS;
    
    for (const [sheetName, initialData] of Object.entries(requiredSheets)) {
      const sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, initialData.length, initialData[0].length).setValues(initialData);
      sheet.setFrozenRows(1);
      
      // シートの色付けと説明
      this.setSheetColorAndDescription(sheet, sheetName);
    }
    
    // ダミー初期設定の入力 (00_システム設定)
    const settingSheet = ss.getSheetByName('00_システム設定');
    settingSheet.getRange(2, 2, 4, 2).setValues([
      ['一時ファイル保存先フォルダID', '利用者が入力'],
      ['一時ファイル保持期限(日)', '1'],
      ['最終清掃日時', ''],
      ['CSV出力先GoogleドライブフォルダID', '利用者が入力']
    ]);
  },
  
  /**
   * シートタブの色付けと上部説明（役割・操作など）の設定
   */
  setSheetColorAndDescription: function(sheet, sheetName) {
    const prefix = sheetName.substring(0, 2);
    let color = null;
    let role = '';
    let operation = '';
    
    if (prefix === '00' || prefix === '01' || prefix === '05' || prefix === '06') {
      color = '#4a86e8'; // 青: 設定・マスタ
      role = 'システムの設定やマスタデータです。';
      operation = '利用者が入力・変更するシートです。列は削除しないでください。';
    } else if (prefix === '02' || prefix === '03' || prefix === '04') {
      color = '#e06666'; // 赤系: 分析条件・元データ
      role = '分析実行時に使用される一時的なデータや条件です。';
      operation = 'GASが自動更新します。利用者は直接変更しないでください。';
    } else if (prefix === '10') {
      color = '#f1c232'; // 黄色: 貼付用
      role = 'データを手動で貼り付けるためのシートです。';
      operation = '2行目以降にデータを貼り付け、取込を実行してください。';
    } else if (prefix === '11') {
      color = '#6aa84f'; // 緑: 標準化データ
      role = '分析の元となる正規のデータ（標準化データ）です。';
      operation = '通常はGASが登録します。手動で変更しないでください。';
    } else if (prefix === '20' || prefix === '21' || prefix === '23') {
      color = '#8e7cc3'; // 紫: 分析結果
      role = '分析処理の計算結果が出力されるシートです。';
      operation = 'GASが毎回上書きします。利用者は入力しないでください。';
    } else if (prefix === '12' || prefix === '40' || prefix === '41' || prefix === '42') {
      color = '#999999'; // グレー: 履歴・ログ
      role = 'システムの実行履歴やエラーのログです。';
      operation = 'GASが追記します。';
    }
    
    if (color) {
      sheet.setTabColor(color);
    }
    
    // ヘッダーの上に1行挿入して説明を入れるのは行ズレを起こすので、
    // メモ(Note)としてA1セルに説明を付与する形にするか、データ開始行をずらすか。
    // 仕様では「各シートのA1または上部に以下を表示」とあるが、既存のREQUIRED_SHEETSの1行目は列名なので、
    // 列の間に挿入すると他ロジックが壊れる。ここではA1セルの「メモ」に表示する方式とする。
    if (role) {
      sheet.getRange('A1').setNote(`役割:\n${role}\n\n操作:\n${operation}`);
    }
  },
  
  /**
   * テスト用の4社マスタ登録
   */
  registerTestCompanies: function(ss) {
    const sheet = ss.getSheetByName('01_路線会社マスタ');
    const now = new Date();
    
    const companies = [
      ['A001', 'テスト運輸A', 'テスト運輸A', 'アプリ3内シート', '', '11_A001_標準化出荷データ', '10_A001_標準化データ貼付', true, true, true, 1, 'テスト用（自動生成）', now, now],
      ['B001', 'テスト運輸B', 'テスト運輸B', 'アプリ3内シート', '', '11_B001_標準化出荷データ', '10_B001_標準化データ貼付', true, true, true, 2, 'テスト用（自動生成）', now, now],
      ['C001', 'テスト運輸C', 'テスト運輸C', 'アプリ3内シート', '', '11_C001_標準化出荷データ', '10_C001_標準化データ貼付', true, true, true, 3, 'テスト用（自動生成）', now, now],
      ['D001', 'テスト運輸D', 'テスト運輸D', 'アプリ3内シート', '', '11_D001_標準化出荷データ', '10_D001_標準化データ貼付', true, true, true, 4, 'テスト用（自動生成）', now, now]
    ];
    
    sheet.getRange(2, 1, companies.length, companies[0].length).setValues(companies);
  },
  
  /**
   * 4社分のシート作成
   */
  createCompanySheets: function(ss) {
    const companies = [
      { code: 'A001', std: '11_A001_標準化出荷データ', paste: '10_A001_標準化データ貼付' },
      { code: 'B001', std: '11_B001_標準化出荷データ', paste: '10_B001_標準化データ貼付' },
      { code: 'C001', std: '11_C001_標準化出荷データ', paste: '10_C001_標準化データ貼付' },
      { code: 'D001', std: '11_D001_標準化出荷データ', paste: '10_D001_標準化データ貼付' }
    ];
    
    const stdHeaders = [
      '標準化データID', '原本データID', '対象年月', '出荷日', 
      '路線便会社コード', '路線便会社名', '出荷元コード', '出荷元名',
      '届け先コード', '届け先名称', '届け先郵便番号', '届け先住所',
      '都道府県', '市区町村', '個数', '重量', 'サイズ', '実績運賃',
      '管理番号', '有効フラグ', 'エラー有無', '特記事項'
    ];
    
    companies.forEach(c => {
      // 標準化データシート
      const stdSheet = ss.insertSheet(c.std);
      stdSheet.getRange(1, 1, 1, stdHeaders.length).setValues([stdHeaders]);
      stdSheet.setFrozenRows(1);
      this.setSheetColorAndDescription(stdSheet, c.std);
      
      // 貼付用シート
      const pasteSheet = ss.insertSheet(c.paste);
      pasteSheet.getRange(1, 1, 1, stdHeaders.length).setValues([stdHeaders]);
      pasteSheet.setFrozenRows(1);
      this.setSheetColorAndDescription(pasteSheet, c.paste);
    });
  },
  
  /**
   * 4社分のダミーデータ（40件以上＋固定テストデータ）生成
   */
  generateDummyData: function(ss) {
    const companies = [
      { code: 'A001', name: 'テスト運輸A', sheet: '11_A001_標準化出荷データ', pasteSheet: '10_A001_標準化データ貼付' },
      { code: 'B001', name: 'テスト運輸B', sheet: '11_B001_標準化出荷データ' },
      { code: 'C001', name: 'テスト運輸C', sheet: '11_C001_標準化出荷データ' },
      { code: 'D001', name: 'テスト運輸D', sheet: '11_D001_標準化出荷データ' }
    ];
    
    // 【固定データS001〜S003用】
    const fixedDataA = [
      ['S001', 'O_S001', '2026-07', '2026/07/01', 'A001', 'テスト運輸A', 'H001', '出荷元H1', 'D001', 'テスト商事 名古屋営業所', '460-0000', '愛知県名古屋市...', '愛知県', '名古屋市', 2, 5, '', 100, '', true, false, '固定テスト正常'],
      ['S002', 'O_S002', '2026-07', '2026/07/02', 'A001', 'テスト運輸A', 'H001', '出荷元H1', 'D002', 'テスト工業 大阪工場', '530-0000', '大阪府大阪市...', '大阪府', '大阪市', 3, 10, '', '', '', true, false, '運賃空白'],
      ['S003', 'O_S003', '2026-07', '2026/07/03', 'A001', 'テスト運輸A', 'H001', '出荷元H1', 'D003', 'テスト商店 福岡支店', '810-0000', '福岡県福岡市...', '福岡県', '福岡市', '', 10, '', 200, '', true, false, '個数空白']
    ];
    
    // A社に固定データを注入
    const sheetA = ss.getSheetByName(companies[0].sheet);
    sheetA.getRange(2, 1, 3, 22).setValues(fixedDataA);
    
    // A社の貼付シートにテスト用ダミーデータを2件入れる
    const pasteSheetA = ss.getSheetByName(companies[0].pasteSheet);
    pasteSheetA.getRange(2, 1, 2, 22).setValues([
      ['P001', 'O_P001', '2026-07', '2026/07/15', 'A001', 'テスト運輸A', 'H001', '出荷元H1', 'D004', '貼付テスト商事1', '', '', '', '', 1, 2, '', 500, '', true, false, '貼付データ1'],
      ['P002', 'O_P002', '2026-07', '2026/07/16', 'A001', 'テスト運輸A', 'H001', '出荷元H1', 'D005', '貼付テスト商事2', '', '', '', '', 2, 4, '', 800, '', true, false, '貼付データ2']
    ]);
    
    // その他のランダムダミーデータ生成
    companies.forEach(comp => {
      const sheet = ss.getSheetByName(comp.sheet);
      const data = [];
      const startRow = (comp.code === 'A001') ? 5 : 2; // A社はS001〜S003が既にあるため
      
      const targetMonths = ['2026-07', '2026-08'];
      
      for (const month of targetMonths) {
        // 各月5件生成
        for (let i = 1; i <= 5; i++) {
          const isError = (i === 4); // 4件目はエラーデータ
          const isInvalid = (i === 5); // 5件目は無効データ
          
          // 届け先を被らせるため、D001は全社に共通で持たせる
          const dCode = (i === 1) ? 'D001' : `D00${i + 1}`;
          const dName = (i === 1) ? 'テスト商事 名古屋営業所' : `テスト宛先_${comp.code}_${i}`;
          
          // 重量空白テスト用
          const weight = (i === 3) ? '' : (Math.floor(Math.random() * 20) + 1);
          
          data.push([
            `${comp.code}_${month.replace('-','')}_${i}`, // 標準化データID
            `ORG_${comp.code}_${month.replace('-','')}_${i}`,
            month,
            `${month.replace('-', '/')}/10`,
            comp.code,
            comp.name,
            'H001',
            '出荷元H1',
            dCode,
            dName,
            '100-0000',
            '東京都...',
            '東京都',
            '千代田区',
            Math.floor(Math.random() * 5) + 1, // 個数
            weight, // 重量
            '', // サイズ
            (i === 2) ? '' : (Math.floor(Math.random() * 1000) + 500), // 実績運賃 (2件目は運賃空白)
            '', // 管理番号
            !isInvalid, // 有効フラグ
            isError, // エラー有無
            isError ? 'エラーテスト' : (isInvalid ? '無効テスト' : '正常') // 特記事項
          ]);
        }
      }
      sheet.getRange(startRow, 1, data.length, 22).setValues(data);
    });
  },
  
  /**
   * 出荷元・届け先マスタ等のダミーデータ生成
   */
  generateMasterDummyData: function(ss) {
    // 出荷元マスタ
    const sheetShuka = ss.getSheetByName('05_出荷元マスタ');
    sheetShuka.getRange(2, 1, 3, 8).setValues([
      ['H001', '出荷元H1', '2026/01/01', '2026/08/31', true, new Date(), new Date(), ''],
      ['H002', '出荷元H2', '2026/01/01', '2026/08/31', true, new Date(), new Date(), ''],
      ['H003', '出荷元H3', '2026/01/01', '2026/08/31', true, new Date(), new Date(), '']
    ]);
    
    // 届け先マスタ
    const sheetTodoke = ss.getSheetByName('06_届け先マスタ');
    sheetTodoke.getRange(2, 1, 5, 15).setValues([
      ['D_01', 'H001', 'D001', '', 'テスト商事 名古屋営業所', '460-0000', '愛知県名古屋市...', '愛知県', '名古屋市', '2026/01/01', '2026/08/31', true, new Date(), new Date(), '共通宛先'],
      ['D_02', 'H001', 'D002', '', 'テスト工業 大阪工場', '530-0000', '大阪府大阪市...', '大阪府', '大阪市', '2026/01/01', '2026/08/31', true, new Date(), new Date(), ''],
      ['D_03', 'H001', 'D003', '', 'テスト商店 福岡支店', '810-0000', '福岡県福岡市...', '福岡県', '福岡市', '2026/01/01', '2026/08/31', true, new Date(), new Date(), ''],
      ['D_04', 'H001', 'D004', '', 'テスト関連 D4', '100-0000', '東京都...', '東京都', '千代田区', '2026/01/01', '2026/08/31', true, new Date(), new Date(), ''],
      ['D_05', 'H001', 'D005', '', 'テスト関連 D5', '100-0000', '東京都...', '東京都', '千代田区', '2026/01/01', '2026/08/31', true, new Date(), new Date(), '']
    ]);
    
    // 最後に一時シート（初期化中...）を削除
    const tempSheet = ss.getSheetByName('初期化中...');
    if (tempSheet) {
      ss.deleteSheet(tempSheet);
    }
  }
};
