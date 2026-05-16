/**
 * 【担当1：エラー修正担当】
 * カレンダー設定の安定化と日付判定ルールの緩和（最新版）
 * 
 * 主な修正点：
 * 1. 設定アドレスの読み取り位置を A2 または B1 の両方に対応
 * 2. 日付・時刻の後のスペースなし（15:00テスト等）でも認識するように修正
 * 3. 前後の不要な空白を自動除去
 * 4. デバッグ用に読み込んだIDをエラーメッセージに含める機能
 */

// --- 設定エリア ---
const LINE_TOKEN = 'iR7vPwaizF+JujidhAQxaq/jhzCCt+Ded1cnmXeTECqjzRusOF+rArPq1h8bIBs/MhpzqZ36JVNHHeC/viTPblbrDCH4kWjQEsL/FkkwTNl/Ig1bBoChfQPxbACBFKsdJVL011VeYI3xfFP4dndvBgdB04t89/1O/w1cDnyilFU=';
const SS_ID = '1q0vqhijW2Ac-T6cTNjtzc3-TiAKdHLGBXhWt1HRoNew'; 
const USER_SHEET_NAME = 'シート1';
const SETTINGS_SHEET_NAME = '設定';
const DEFAULT_CALENDAR_ID = 'gm.dache11@gmail.com'; 
// ------------------

/**
 * スプレッドシートからカレンダーIDを柔軟に取得する
 */
function getCalendarId() {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
    if (settingsSheet) {
      // A2（文字の下）と B1（文字の右）の両方をチェック
      const idA2 = settingsSheet.getRange('A2').getValue().toString().trim();
      const idB1 = settingsSheet.getRange('B1').getValue().toString().trim();
      
      const targetId = (idB1.includes('@')) ? idB1 : (idA2.includes('@') ? idA2 : null);
      if (targetId) return targetId;
    }
  } catch (e) {
    console.log('設定シートの読み込みに失敗しました: ' + e.message);
  }
  return DEFAULT_CALENDAR_ID;
}

function doGet(e) {
  return ContentService.createTextOutput("ボット（エラー修正版）は正常に稼働しています！現在のカレンダーID: " + getCalendarId());
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let logSheet = ss.getSheetByName('ログ');
  if (!logSheet) logSheet = ss.insertSheet('ログ');
  
  const now = new Date();
  
  try {
    const contents = e.postData.contents;
    logSheet.appendRow([now, '【受信信号】', contents]);
    
    const json = JSON.parse(contents);
    if (!json.events || json.events.length === 0) return ContentService.createTextOutput("OK");

    const event = json.events[0];
    const replyToken = event.replyToken;
    const userId = event.source.userId;

    // 友達登録時
    if (event.type === 'follow') {
      saveUser(userId);
      sendReply(replyToken, '友達登録ありがとうございます！\n予定の確認や追加ができます。');
    }

    // メッセージ受信時
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim(); // 空白除去
      logSheet.appendRow([now, '【メッセージ内容】', text]);
      
      if (text === '今日の予定') {
        sendReply(replyToken, getSchedule('today'));
      } else if (text === '明日の予定') {
        sendReply(replyToken, getSchedule('tomorrow'));
      } else if (text === '1週間の予定') {
        sendReply(replyToken, getSchedule('week'));
      } else if (text.match(/\d{4}[\/\-\s]\d{1,2}[\/\-\s]\d{1,2}\s+\d{1,2}:\d{2}/)) {
        // 日時形式にマッチした場合（スペースなしでもOK）
        sendReply(replyToken, addEvent(text));
      } else {
        // ヘルプ
        sendReply(replyToken, 'メッセージを受信しました。\n\n【予定の確認】\n「今日の予定」と送ってください。\n\n【予定の登録】\n「2026/04/10 15:00 打ち合わせ」のように送ってください。');
      }
    }
    return ContentService.createTextOutput("OK");

  } catch (err) {
    logSheet.appendRow([now, '【致命的エラー】', err.message, err.stack]);
    return ContentService.createTextOutput("OK");
  }
}

function saveUser(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(USER_SHEET_NAME);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    const exists = data.some(row => row[1] === userId);
    if (!exists) sheet.appendRow([new Date(), userId, '新規']);
  }
}

function getSchedule(type) {
  const now = new Date();
  let start, end;
  if (type === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); 
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (type === 'tomorrow') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0); 
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); 
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
  }

  const calendarId = getCalendarId();
  try {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) return 'カレンダーが見つかりません。共有設定を確認してください。\n(ID: ' + calendarId + ')';
    
    const events = calendar.getEvents(start, end);
    if (events.length === 0) return '予定はありません。';
    
    let msg = '【予定一覧】\n';
    events.forEach(e => { 
      msg += `${Utilities.formatDate(e.getStartTime(), 'JST', 'HH:mm')}〜 ${e.getTitle()}\n`; 
    });
    return msg;
  } catch (e) {
    return 'カレンダー取得エラーが発生しました。\n(ID: ' + calendarId + ')';
  }
}

function addEvent(text) {
  const match = text.match(/(\d{4}[\/\-\s]\d{1,2}[\/\-\s]\d{1,2})\s+(\d{1,2}:\d{2})\s*(.*)/);
  if (!match) return '形式が正しくありません。「YYYY/MM/DD HH:mm タイトル」のように送ってください。';
  
  const datePart = match[1].replace(/-/g, '/'); // ハイフンをスラッシュに統一
  const timePart = match[2];
  const title = match[3] || '無題の予定';
  
  const calendarId = getCalendarId();
  try {
    const start = new Date(datePart + ' ' + timePart);
    const end = new Date(start.getTime() + 60 * 60 * 1000); 
    
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) return '登録先のカレンダーが見つかりません。\n(ID: ' + calendarId + ')';
    
    calendar.createEvent(title, start, end);
    return '【登録完了】\n' + datePart + ' ' + timePart + ' に「' + title + '」を登録しました。';
  } catch (e) {
    return '予定登録に失敗しました。形式を確認してください。\n(ID: ' + calendarId + ')';
  }
}

function sendReply(replyToken, message) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  UrlFetchApp.fetch(url, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINE_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{ 'type': 'text', 'text': message }],
    }),
  });
}
