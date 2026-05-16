/**
 * 【担当2：実装担当】
 * 日時選択ツール（Datetime Picker）による直感的な予定登録実装
 * 
 * 使い方：
 * 1. リッチメニューの「予定を入れる」のアクションを「ポストバック」にし、
 *    データ欄を "action=select_date" に設定してください。
 * 2. ボタンを押すとカレンダー選択ツールが開きます。
 * 3. 日時を選ぶと、ボットが「予定の内容を入力してください」と聞きます。
 * 4. 内容を送ると登録されます。
 */

// --- 設定エリア ---
const LINE_TOKEN = 'iR7vPwaizF+JujidhAQxaq/jhzCCt+Ded1cnmXeTECqjzRusOF+rArPq1h8bIBs/MhpzqZ36JVNHHeC/viTPblbrDCH4kWjQEsL/FkkwTNl/Ig1bBoChfQPxbACBFKsdJVL011VeYI3xfFP4dndvBgdB04t89/1O/w1cDnyilFU=';
const SS_ID = '1q0vqhijW2Ac-T6cTNjtzc3-TiAKdHLGBXhWt1HRoNew'; 
const USER_SHEET_NAME = 'シート1';
const SETTINGS_SHEET_NAME = '設定';
const TEMP_SHEET_NAME = '一時保存'; // 状態管理用
const DEFAULT_CALENDAR_ID = 'gm.dache11@gmail.com'; 
// ------------------

function getCalendarId() {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
    if (settingsSheet) {
      const idA2 = settingsSheet.getRange('A2').getValue().toString().trim();
      const idB1 = settingsSheet.getRange('B1').getValue().toString().trim();
      const targetId = (idB1.includes('@')) ? idB1 : (idA2.includes('@') ? idA2 : null);
      if (targetId) return targetId;
    }
  } catch (e) {}
  return DEFAULT_CALENDAR_ID;
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let logSheet = ss.getSheetByName('ログ');
  if (!logSheet) logSheet = ss.insertSheet('ログ');
  let tempSheet = ss.getSheetByName(TEMP_SHEET_NAME);
  if (!tempSheet) {
    tempSheet = ss.insertSheet(TEMP_SHEET_NAME);
    tempSheet.appendRow(['userId', 'date', 'status']);
  }
  
  const now = new Date();
  
  try {
    const contents = e.postData.contents;
    const json = JSON.parse(contents);
    if (!json.events || json.events.length === 0) return ContentService.createTextOutput("OK");

    const event = json.events[0];
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    // --- ポストバックイベント（カレンダーから日時を選択した時） ---
    if (event.type === 'postback') {
      const data = event.postback.data;
      if (data === 'action=select_date') {
        const selectedDate = event.postback.params.datetime; // "2026-04-11T15:00" 形式
        
        // 一時保存シートに記録（上書きまたは新規）
        updateTempStatus(userId, selectedDate, 'WAIT_FOR_TITLE');
        
        const displayDate = selectedDate.replace('T', ' ');
        sendReply(replyToken, `日時を確認しました：${displayDate}\n\n続いて「予定の内容（タイトル）」をメッセージで送ってください。`);
      }
      return ContentService.createTextOutput("OK");
    }

    // --- メッセージイベント ---
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      
      // 一時保存を確認
      const pendingData = getTempStatus(userId);
      
      if (pendingData && pendingData.status === 'WAIT_FOR_TITLE') {
        // タイトル入力待ちの場合：登録を実行
        const result = addEventDetailed(pendingData.date, text);
        clearTempStatus(userId); // 状態をクリア
        sendReply(replyToken, result);
      } else {
        // 通常のメニュー処理
        if (text === '今日の予定') {
          sendReply(replyToken, getSchedule('today'));
        } else if (text === '予定を入れる') {
          // 日時選択ボタンを送る
          sendDateTimePicker(replyToken);
        } else {
          sendReply(replyToken, 'メニューから操作するか、日時の後に予定を書いて送ってください。\n（例：2026/04/10 15:00 会議）');
        }
      }
    }
    return ContentService.createTextOutput("OK");

  } catch (err) {
    logSheet.appendRow([now, '【エラー】', err.message]);
    return ContentService.createTextOutput("OK");
  }
}

/**
 * 日時選択ツールを送る
 */
function sendDateTimePicker(replyToken) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    'replyToken': replyToken,
    'messages': [{
      'type': 'template',
      'altText': '日時を選択してください',
      'template': {
        'type': 'buttons',
        'text': 'いつの予定を入れますか？',
        'actions': [{
          'type': 'datetimepicker',
          'label': '日付・時刻を選択',
          'data': 'action=select_date',
          'mode': 'datetime'
        }]
      }
    }]
  };
  UrlFetchApp.fetch(url, {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_TOKEN },
    'method': 'post',
    'payload': JSON.stringify(payload)
  });
}

/**
 * 状態管理用
 */
function updateTempStatus(userId, date, status) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(TEMP_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      sheet.getRange(i + 1, 2).setValue(date);
      sheet.getRange(i + 1, 3).setValue(status);
      found = true; break;
    }
  }
  if (!found) sheet.appendRow([userId, date, status]);
}

function getTempStatus(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(TEMP_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) return { date: data[i][1], status: data[i][2] };
  }
  return null;
}

function clearTempStatus(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(TEMP_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

/**
 * 登録実行
 */
function addEventDetailed(isoDate, title) {
  const calendarId = getCalendarId();
  try {
    const start = new Date(isoDate.replace(/-/g, '/').replace('T', ' '));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) return 'カレンダーが見つかりません。';
    calendar.createEvent(title, start, end);
    return `【登録完了】\n${isoDate.replace('T', ' ')} に「${title}」を登録しました！`;
  } catch (e) {
    return '登録に失敗しました。';
  }
}

function getSchedule(type) {
  // ※getSchedule の実装は担当1と同じため省略（適宜コピーしてください）
  return "本日の予定を表示する機能です（担当1のコードを参照してください）";
}

function sendReply(replyToken, message) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  UrlFetchApp.fetch(url, {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_TOKEN },
    'method': 'post',
    'payload': JSON.stringify({ 'replyToken': replyToken, 'messages': [{ 'type': 'text', 'text': message }] })
  });
}
