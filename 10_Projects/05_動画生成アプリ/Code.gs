/**
 * 動画生成アプリ連携スクリプト
 * Geminiが出力したプロンプトをCoze APIに送信し、結果を取得する。
 */

/**
 * スプレッドシートが開かれたときに実行される関数
 * カスタムメニューを追加します。
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🎬 動画制作 (Coze)')
    .addItem('0. 初期設定（シート作成）', 'setupSheet')
    .addSeparator()
    .addItem('1. 未処理のプロンプトを送信', 'sendToCoze')
    .addItem('2. 制作中の結果を確認', 'checkCozeStatus')
    .addToUi();
}

/**
 * 0. 初期設定（スプレッドシートの見出しを作成）
 * ユーザーが手動で項目を作らなくて済むようにフォーマットします。
 */
function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var headers = [
    '編集実行プロンプト', 
    '素材動画のURL', 
    'ステータス', 
    'Task ID / Conversation ID (システム用)', 
    '完成URL (プレビュー・CapCutリンク)'
  ];
  
  // 1行目にヘッダーをセット
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // ヘッダーの装飾（見やすくする）
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  
  // 1行目を固定
  sheet.setFrozenRows(1);
  
  // 列幅の調整
  sheet.setColumnWidth(1, 400); // プロンプト
  sheet.setColumnWidth(2, 250); // 素材
  sheet.setColumnWidth(3, 120); // ステータス
  sheet.setColumnWidth(4, 250); // Task ID
  sheet.setColumnWidth(5, 400); // 完成URL
  
  SpreadsheetApp.getUi().alert('シートの初期設定（見出しの作成）が完了しました！');
}

/**
 * 共通設定
 * 列の構成が変わった場合はここを変更してください。
 */
const CONFIG = {
  COLUMNS: {
    PROMPT: 1,      // A列: 編集実行プロンプト
    MATERIAL: 2,    // B列: 素材動画のURL
    STATUS: 3,      // C列: ステータス
    TASK_ID: 4,     // D列: Task ID / Conversation ID (システム用)
    RESULT_URL: 5   // E列: 完成URL (プレビュー・CapCutリンク)
  },
  STATUS: {
    PENDING: '未処理',
    EMPTY: '',
    IN_PROGRESS: '制作中',
    DONE: '完了',
    ERROR: 'エラー'
  }
};

/**
 * Coze APIの設定を取得
 * 事前に [拡張機能] > [Apps Script] > [プロジェクトの設定] のスクリプトプロパティに設定が必要
 */
function getCozeConfig() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('Coze_API_KEY');
  var botId = props.getProperty('bot_id');
  var userId = props.getProperty('user_id');

  if (!apiKey || !botId || !userId) {
    throw new Error('スクリプトプロパティに Coze_API_KEY, bot_id, user_id が設定されていません。');
  }

  return {
    apiKey: apiKey,
    botId: botId,
    userId: userId
  };
}

/**
 * 1. 未処理のプロンプトをCozeに送信する
 */
function sendToCoze() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return; // ヘッダーのみの場合は終了

  var config = getCozeConfig();
  var dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn() || 5);
  var data = dataRange.getValues();

  var updated = false;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowIndex = i + 2;
    var prompt = row[CONFIG.COLUMNS.PROMPT - 1];
    var material = row[CONFIG.COLUMNS.MATERIAL - 1];
    var status = row[CONFIG.COLUMNS.STATUS - 1];

    // プロンプトが存在し、ステータスが未処理（または空）の場合
    if (prompt && (status === CONFIG.STATUS.PENDING || status === CONFIG.STATUS.EMPTY)) {
      try {
        var taskId = callCozeBotApi(config, prompt, material);
        
        // ステータスとタスクIDを書き込み
        sheet.getRange(rowIndex, CONFIG.COLUMNS.STATUS).setValue(CONFIG.STATUS.IN_PROGRESS);
        sheet.getRange(rowIndex, CONFIG.COLUMNS.TASK_ID).setValue(taskId);
        updated = true;
        
        // 連続リクエストによるAPI制限を防ぐためのウェイト
        Utilities.sleep(1000); 
      } catch (e) {
        sheet.getRange(rowIndex, CONFIG.COLUMNS.STATUS).setValue(CONFIG.STATUS.ERROR);
        sheet.getRange(rowIndex, CONFIG.COLUMNS.RESULT_URL).setValue(e.toString());
      }
    }
  }

  if (updated) {
    SpreadsheetApp.getUi().alert('送信が完了しました。「制作中」のステータスを確認してください。');
  } else {
    SpreadsheetApp.getUi().alert('送信対象（未処理）のデータがありませんでした。');
  }
}

/**
 * Coze API (v3 Chat) にリクエストを送信する
 */
function callCozeBotApi(config, prompt, material) {
  var url = 'https://api.coze.com/v3/chat';
  
  // 要件に基づくメッセージ構成
  var payload = {
    bot_id: config.botId,
    user_id: config.userId,
    additional_messages: [
      {
        role: "user",
        content: "以下のプロンプトと素材で動画を作ってください\n\n【プロンプト】\n" + prompt + "\n\n【素材】\n" + (material || 'なし'),
        content_type: "text"
      }
    ]
  };

  var options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + config.apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200 || json.code !== 0) {
    throw new Error('Coze API エラー: ' + (json.msg || response.getContentText()));
  }

  // 成功した場合、chat_id と conversation_id を返す
  var chatId = json.data.id;
  var conversationId = json.data.conversation_id;
  
  return chatId + ":" + conversationId;
}

/**
 * 2. 制作中の結果を取得する
 */
function checkCozeStatus() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var config = getCozeConfig();
  var dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn() || 5);
  var data = dataRange.getValues();

  var updated = false;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowIndex = i + 2;
    var status = row[CONFIG.COLUMNS.STATUS - 1];
    var taskIds = row[CONFIG.COLUMNS.TASK_ID - 1]; // "chat_id:conversation_id"

    if (status === CONFIG.STATUS.IN_PROGRESS && taskIds) {
      var ids = taskIds.split(":");
      var chatId = ids[0];
      var conversationId = ids[1];

      try {
        var result = fetchCozeResult(config, chatId, conversationId);
        
        if (result.status === 'completed') {
          sheet.getRange(rowIndex, CONFIG.COLUMNS.STATUS).setValue(CONFIG.STATUS.DONE);
          sheet.getRange(rowIndex, CONFIG.COLUMNS.RESULT_URL).setValue(result.outputUrl);
          updated = true;
        } else if (result.status === 'failed') {
          sheet.getRange(rowIndex, CONFIG.COLUMNS.STATUS).setValue(CONFIG.STATUS.ERROR);
          sheet.getRange(rowIndex, CONFIG.COLUMNS.RESULT_URL).setValue("生成失敗またはキャンセルされました。");
          updated = true;
        }
        
        Utilities.sleep(500); // APIレートリミット対策
      } catch (e) {
        // エラー時は何もしない（次回再試行）
      }
    }
  }

  if (updated) {
    SpreadsheetApp.getUi().alert('ステータスの更新が完了しました。');
  } else {
    SpreadsheetApp.getUi().alert('更新対象がない、またはまだ全件生成中です。');
  }
}

/**
 * Cozeからの結果メッセージを取得
 */
function fetchCozeResult(config, chatId, conversationId) {
  // まずチャットのステータスを確認
  var statusUrl = 'https://api.coze.com/v3/chat/retrieve?chat_id=' + chatId + '&conversation_id=' + conversationId;
  
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + config.apiKey
    },
    muteHttpExceptions: true
  };

  var statusRes = UrlFetchApp.fetch(statusUrl, options);
  var statusJson = JSON.parse(statusRes.getContentText());

  if (statusJson.code !== 0) {
    return { status: 'error' };
  }

  var chatStatus = statusJson.data.status;

  // completed の場合は返答内容を取得
  if (chatStatus === 'completed') {
    var msgUrl = 'https://api.coze.com/v3/chat/message/list?chat_id=' + chatId + '&conversation_id=' + conversationId;
    var msgRes = UrlFetchApp.fetch(msgUrl, options);
    var msgJson = JSON.parse(msgRes.getContentText());
    
    if (msgJson.code === 0 && msgJson.data) {
      // Botの最新メッセージ（type: 'answer'）を探す
      var botMessages = msgJson.data.filter(function(msg) {
        return msg.role === 'assistant' && msg.type === 'answer';
      });
      
      if (botMessages.length > 0) {
        return { status: 'completed', outputUrl: botMessages[0].content };
      }
    }
    return { status: 'completed', outputUrl: '結果メッセージが見つかりませんでした。' };
  } else if (chatStatus === 'failed' || chatStatus === 'canceled') {
    return { status: 'failed' };
  }

  // in_progress または created などの場合はそのまま
  return { status: 'in_progress' };
}
