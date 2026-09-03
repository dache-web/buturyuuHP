/**
 * 自己検収エンジン - スプレッドシート初期構築スクリプト (第1工程 STEP2)
 */

const PROP_KEY_SPREADSHEET_ID = 'SELF_VALIDATION_SPREADSHEET_ID';

/**
 * 自己検収エンジン専用スプレッドシートのセットアップ関数
 * ユーザーはこの関数を選択して実行してください。
 */
function setupSelfValidationEngine() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty(PROP_KEY_SPREADSHEET_ID);
  let ss = null;
  let isNew = false;

  console.log('=== 自己検収エンジン セットアップ開始 ===');

  try {
    if (spreadsheetId) {
      try {
        ss = SpreadsheetApp.openById(spreadsheetId);
        console.log(`既存のスプレッドシートを再利用します。ID: ${spreadsheetId}`);
      } catch (e) {
        const humanMsg = `【エラー】保存されているSpreadsheet ID (${spreadsheetId}) のスプレッドシートを開けませんでした。\n` +
          `手動削除されているかアクセス権がない可能性があります。勝手に新しいSpreadsheetは作成していません。`;
        console.error(humanMsg);
        console.error(`技術エラー詳細: ${e.toString()}`);
        throw new Error(humanMsg);
      }
    } else {
      isNew = true;
      ss = SpreadsheetApp.create('自己検収エンジン_管理シート');
      spreadsheetId = ss.getId();
      props.setProperty(PROP_KEY_SPREADSHEET_ID, spreadsheetId);
      console.log(`新しいスプレッドシートを作成しました。ID: ${spreadsheetId}`);
    }

    // 8シートの定義
    const sheetDefinitions = getSheetDefinitions_();

    let createdCount = 0;
    let reusedCount = 0;

    // 各シートの処理
    sheetDefinitions.forEach(def => {
      let sheet = ss.getSheetByName(def.name);
      if (!sheet) {
        sheet = ss.insertSheet(def.name);
        createdCount++;
        console.log(`シート「${def.name}」を作成しました。`);
      } else {
        reusedCount++;
        console.log(`シート「${def.name}」は既存のものを再利用します。`);
      }

      setupSheetContent_(sheet, def);
    });

    // 初期生成時デフォルトの不要シート（「シート1」や「Sheet1」）を削除（他の8シートが存在する場合のみ）
    cleanDefaultSheets_(ss, sheetDefinitions.map(d => d.name));

    // 結果ログ表示
    console.log('====================================');
    console.log('自己検収エンジン セットアップ完了!');
    console.log(`・区分: ${isNew ? '新規作成' : '既存再利用'}`);
    console.log(`・スプレッドシート名: ${ss.getName()}`);
    console.log(`・作成シート数: ${createdCount}`);
    console.log(`・再利用シート数: ${reusedCount}`);
    console.log(`・URL: ${ss.getUrl()}`);
    console.log('====================================');

    return {
      success: true,
      isNew: isNew,
      spreadsheetName: ss.getName(),
      createdCount: createdCount,
      reusedCount: reusedCount,
      url: ss.getUrl()
    };

  } catch (error) {
    console.error('【システムエラー】セットアップ処理が中断されました。');
    console.error(`エラー詳細: ${error.message || error.toString()}`);
    throw error;
  }
}

/**
 * シートの内容（ヘッダーおよび初期データ）を設定する内部関数
 * 既存データを消去せず、不足分のみ追加します。
 */
function setupSheetContent_(sheet, def) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // 1. ヘッダー設定（空シートの場合のみ設置）
  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
  }

  // 見た目スタイル最小限設定
  const headerRange = sheet.getRange(1, 1, 1, def.headers.length);
  headerRange.setBackground('#f3f3f3');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 2. 初期値追加（既存項目キーと照合して未設定の行のみ末尾に追加）
  if (def.initialData && def.initialData.length > 0) {
    const currentLastRow = sheet.getLastRow();
    let existingKeys = new Set();

    if (currentLastRow > 1) {
      // 1列目（項目キーまたは項目名）をキーとして重複チェック
      const existingValues = sheet.getRange(2, 1, currentLastRow - 1, 1).getValues();
      existingValues.forEach(row => {
        if (row[0] !== '') existingKeys.add(String(row[0]).trim());
      });
    }

    const rowsToAdd = def.initialData.filter(row => {
      const key = String(row[0]).trim();
      return !existingKeys.has(key);
    });

    if (rowsToAdd.length > 0) {
      const targetStartRow = sheet.getLastRow() + 1;
      sheet.getRange(targetStartRow, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
      console.log(`シート「${sheet.getName()}」に初期データを ${rowsToAdd.length} 件追加しました。`);
    }
  }

  // 全体スタイルの適用（折り返し）
  const fullLastRow = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(1, 1, fullLastRow, def.headers.length).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  
  // 列幅自動調整
  try {
    sheet.autoResizeColumns(1, def.headers.length);
  } catch (e) {
    // autoResizeColumnsのエラーは無視
  }
}

/**
 * 新規作成時に生成されるデフォルトシート（シート1 / Sheet1 など）を安全に削除
 */
function cleanDefaultSheets_(ss, validSheetNames) {
  const validSet = new Set(validSheetNames);
  const allSheets = ss.getSheets();
  
  if (allSheets.length <= validSheetNames.length) return;

  allSheets.forEach(sheet => {
    const name = sheet.getName();
    if (!validSet.has(name)) {
      try {
        ss.deleteSheet(sheet);
        console.log(`初期デフォルトシート「${name}」を削除しました。`);
      } catch (e) {
        // 最後の1枚だった場合等は削除失敗することがあるためスルー
      }
    }
  });
}

/**
 * 8シートの定義データ取得
 */
function getSheetDefinitions_() {
  return [
    {
      name: '00_このエンジンについて',
      headers: ['項目', '内容'],
      initialData: [
        ['エンジン名', '自己検収エンジン'],
        ['一言説明', '期待した結果と実際の結果が合っているか確認するエンジン'],
        ['目的', 'AIやアプリが出した結果を別の検収ルールで確認する'],
        ['入力', '設定・テストケース・実際結果'],
        ['処理', '期待結果と実際結果を比較する'],
        ['出力', 'PASS / WARNING / FAIL / SYSTEM ERROR と判定理由'],
        ['現在工程', '第1工程 STEP2'],
        ['現在完成', 'Git基盤、スプレッドシート初期構造'],
        ['未完成', '判定ロジック、Web画面、本番アプリ連携'],
        ['今回の確認', '8シートが正しく作成され、再実行しても壊れないこと'],
        ['次工程', '基本比較・判定ロジック']
      ]
    },
    {
      name: '01_基本設定',
      headers: ['設定キー', '設定名', '設定値', '説明', '有効／無効'],
      initialData: [
        ['ENGINE_ENABLED', 'エンジン有効', 'TRUE', '自己検収エンジン全体を使用するか', 'TRUE'],
        ['WARNING_JOB_THRESHOLD', '仕事件数WARNING閾値', '15', '仕事件数がこの値以下の場合にWARNING判定へ使用', 'TRUE'],
        ['LOG_MAX_ROWS', 'ログ最大保存件数', '1000', 'ログ肥大化防止用', 'TRUE']
      ]
    },
    {
      name: '02_テストケース',
      headers: ['テスト番号', 'テスト名', '分類', '確認方法', '対象項目', '期待値', '期待業務判定', '異常時レベル', '有効／無効', '説明'],
      initialData: []
    },
    {
      name: '03_実際結果',
      headers: ['実行番号', '実行日時', '対象項目', '実際値', '取得元', '備考'],
      initialData: []
    },
    {
      name: '04_テスト結果',
      headers: ['実行番号', 'テスト番号', 'テスト名', '期待値', '実際値', '期待業務判定', '実際業務判定', 'メタ判定', '判定理由', '異常レベル', '確認日時'],
      initialData: []
    },
    {
      name: '05_テスト結果説明',
      headers: ['テスト番号', '何を確認するテストか', '入力データ', '比較するもの', '期待結果', '実際結果', '期待業務判定', '実際業務判定', 'メタ判定', 'なぜその判定になったか', '問題があった場合の原因', '修正が必要か', '確認日'],
      initialData: []
    },
    {
      name: '06_エラーログ',
      headers: ['日時', '実行番号', '処理名', '対象データ', '何が起きたか', '人間向け説明', '技術エラー', '処理継続／停止', '修正履歴'],
      initialData: []
    },
    {
      name: '07_実行ログ',
      headers: ['日時', '実行番号', '処理内容', '状態', '詳細説明'],
      initialData: []
    }
  ];
}
