/**
 * 自己検収エンジン - スプレッドシート初期構築スクリプト (第1工程 STEP2 修正版)
 * 方式：コンテナバインド型 (getActiveSpreadsheet利用、新規Spreadsheet作成禁止)
 */

/**
 * 自己検収エンジン専用スプレッドシートのセットアップ関数
 * 現在親となっているGoogleスプレッドシート上に8シートを構築します。
 */
function setupSelfValidationEngine() {
  console.log('=== 自己検収エンジン セットアップ開始 (コンテナバインド方式) ===');

  try {
    // 1. 現在開いている（紐づいている）アクティブなスプレッドシートを取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      const humanMsg = '【エラー】このGASがGoogleスプレッドシートに紐づいていないため、初期構築を実行できませんでした。\n' +
        'Googleスプレッドシートを開き、「拡張機能 > Apps Script」から本スクリプトを実行してください。';
      console.error(humanMsg);
      throw new Error(humanMsg);
    }

    const spreadsheetId = ss.getId();
    const spreadsheetName = ss.getName();
    console.log(`対象スプレッドシート名: ${spreadsheetName} (ID: ${spreadsheetId})`);

    // 2. 8シートの定義取得
    const sheetDefinitions = getSheetDefinitions_();

    let createdCount = 0;
    let reusedCount = 0;

    // 3. 各シートの確認と構築
    sheetDefinitions.forEach(def => {
      let sheet = ss.getSheetByName(def.name);
      if (!sheet) {
        sheet = ss.insertSheet(def.name);
        createdCount++;
        console.log(`シート「${def.name}」を新規作成しました。`);
      } else {
        reusedCount++;
        console.log(`シート「${def.name}」は既存のものを再利用します。`);
      }

      setupSheetContent_(sheet, def);
    });

    // 4. 新規作成時の初期デフォルト空シート（「シート1」や「Sheet1」のみ）を安全に削除
    cleanDefaultSheets_(ss, sheetDefinitions.map(d => d.name));

    // 5. 完了ログ表示
    console.log('====================================');
    console.log('自己検収エンジン セットアップ完了!');
    console.log(`・スプレッドシート名: ${spreadsheetName}`);
    console.log(`・スプレッドシートID: ${spreadsheetId}`);
    console.log(`・新規作成シート数: ${createdCount}`);
    console.log(`・再利用シート数: ${reusedCount}`);
    console.log(`・URL: ${ss.getUrl()}`);
    console.log('====================================');

    return {
      success: true,
      spreadsheetId: spreadsheetId,
      spreadsheetName: spreadsheetName,
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
 * シートの内容（ヘッダーおよび初期データ）を検証・設定する内部関数
 */
function setupSheetContent_(sheet, def) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // A. ヘッダーの確認と設定
  if (lastRow === 0 || lastCol === 0) {
    // 完全な空シートの場合、1行目にヘッダーを設置
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
  } else {
    // 既存データがある場合、ヘッダー行（1行目）の検証
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, def.headers.length)).getValues()[0];
    
    // 必須ヘッダーが正しく存在するか確認
    let isHeaderValid = true;
    for (let i = 0; i < def.headers.length; i++) {
      if (!currentHeaders[i] || String(currentHeaders[i]).trim() !== def.headers[i]) {
        isHeaderValid = false;
        break;
      }
    }

    if (!isHeaderValid) {
      // 1行目が完全に空であるかチェック（ヘッダー未設定の場合）
      const isEmptyHeader = currentHeaders.every(cell => String(cell).trim() === '');
      if (isEmptyHeader) {
        sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
        console.log(`シート「${sheet.getName()}」のヘッダーを設定しました。`);
      } else {
        // 想定と異なる列構造が存在する場合は警告ログを出して上書き防止
        console.warn(`【注意】シート「${sheet.getName()}」の既存ヘッダー構造が定義と異なる可能性があります。データ保護のため既存ヘッダーは上書きしません。`);
      }
    }
  }

  // 見た目スタイル最小限設定（1行目固定、背景色、太字）
  const headerRange = sheet.getRange(1, 1, 1, def.headers.length);
  headerRange.setBackground('#f3f3f3');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  // B. 初期データの追加（既存項目キーと照合して未設定の行のみ末尾に追加）
  if (def.initialData && def.initialData.length > 0) {
    const currentLastRow = sheet.getLastRow();
    let existingKeys = new Set();

    if (currentLastRow > 1) {
      // 1列目（項目キーまたは項目名）をキーとして重複チェック
      const existingValues = sheet.getRange(2, 1, currentLastRow - 1, 1).getValues();
      existingValues.forEach(row => {
        if (row[0] !== '' && row[0] !== null && row[0] !== undefined) {
          existingKeys.add(String(row[0]).trim());
        }
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
    // エラーは無視
  }
}

/**
 * 初期構築時に自動で作成される空のデフォルトシート（「シート1」または「Sheet1」のみ）を安全に削除
 * ユーザー作成の独自シート（「メモ」「検証用」等）は絶対に削除しません。
 */
function cleanDefaultSheets_(ss, requiredSheetNames) {
  const requiredSet = new Set(requiredSheetNames);
  
  // 8シートがすべて存在するかチェック
  const hasAllRequired = requiredSheetNames.every(name => ss.getSheetByName(name) !== null);
  if (!hasAllRequired) return;

  // 削除を許可するデフォルト初期シート名のみ定義
  const DEFAULT_TARGET_NAMES = new Set(['シート1', 'Sheet1']);

  const allSheets = ss.getSheets();
  allSheets.forEach(sheet => {
    const name = sheet.getName();
    
    // 必須8シートに含まれず、かつ指定のデフォルト初期シート名であり、完全に空の場合のみ削除
    if (!requiredSet.has(name) && DEFAULT_TARGET_NAMES.has(name)) {
      if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0) {
        try {
          ss.deleteSheet(sheet);
          console.log(`空の初期デフォルトシート「${name}」を安全に削除しました。`);
        } catch (e) {
          // 削除不可の場合は無視
        }
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
