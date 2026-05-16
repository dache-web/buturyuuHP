/**
 * 【命令遵守：カレンダー登録 ＆ 会議URL ＆ フルログ記録版】
 * 
 * 1. 登録の確実化：情報の保存を強制（flush）し、登録失敗の隙を与えません。
 * 2. 会議URL表示：Google MeetのURLを確実に発行し、完了時に表示します。
 * 3. 会話ログ：送られた言葉を「そのまま」ログシートに実況中継します。
 */

const LINE_TOKEN = 'YOUR_LINE_TOKEN';
const SS_ID = 'YOUR_SPREADSHEET_ID'; 

function doGet() { return ContentService.createTextOutput("稼働中"); }

function doPost(e) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let logSheet = ss.getSheetByName('ログ') || ss.insertSheet('ログ');
  function writeLog(tag, msg) { logSheet.appendRow([new Date(), tag, msg]); }

  try {
    const contents = e.postData.contents;
    const json = JSON.parse(contents);
    if (!json.events || json.events.length === 0) return ContentService.createTextOutput("OK");

    const event = json.events[0];
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    if (event.type === 'postback') {
      const data = event.postback.data;
      writeLog("【ボタン操作】", data);
      
      if (data.startsWith('action=choose_month')) {
        sendDateTimePicker(replyToken, data.split('=')[2]);
        updateStatus(userId, { status: 'WAIT_FOR_DATE' });
      } else if (data === 'action=select_date') {
        const selDate = event.postback.params.datetime;
        updateStatus(userId, { date: selDate, status: 'WAIT_FOR_TITLE' });
        sendReply(replyToken, `日時確定: ${selDate.replace('T', ' ')}\n予定の名前を送ってください。`);
      } else if (data.startsWith('action=set_rem_time')) {
        saveUserPref(userId, 'remTime', data.split('=')[2]);
        sendReply(replyToken, "通知時間を保存しました。");
      } else if (data.startsWith('action=set_rem_type')) {
        saveUserPref(userId, 'remType', data.split('=')[2]);
        sendReply(replyToken, "通知種類を保存しました。");
      } else if (data.startsWith('action=set_meet')) {
        writeLog("【判断】", "Meet要否: " + data.split('=')[2]);
        updateStatus(userId, { meet: data.split('=')[2] });
        sendReply(replyToken, finalizeRegistration(userId, null, writeLog));
      }
    } else if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      writeLog("【ユーザーの発言】", text); // 会話内容をログに記録
      handleMessage(event, userId, replyToken, writeLog);
    }
  } catch (err) { writeLog("【致命的エラー】", err.message); }
  return ContentService.createTextOutput("OK");
}

function handleMessage(event, userId, replyToken, writeLog) {
  const text = event.message.text.trim();
  
  // メニューコマンド
  if (text === 'かんたん予約' || text === 'こだわり予約' || text === '設定' || 
      text.includes('今日') || text.includes('明日') || text.includes('1週間')) {
    clearStatus(userId);
    if (text === 'かんたん予約') {
      updateStatus(userId, { isDetailed: 'false', status: 'SELECT_MONTH' });
      sendMonthSelection(replyToken);
    } else if (text === 'こだわり予約') {
      updateStatus(userId, { isDetailed: 'true', status: 'SELECT_MONTH' });
      sendMonthSelection(replyToken);
    } else if (text === '設定') {
      sendSettingsMenu(replyToken);
    } else {
      let range = text.includes('明日') ? 'tomorrow' : (text.includes('1週間') ? 'week' : 'today');
      sendReply(replyToken, getSchedule(range));
    }
    return;
  }

  const state = getStatus(userId);
  if (state && state.status === 'WAIT_FOR_TITLE') {
    writeLog("【判断】", "名前として登録準備: " + text);
    updateStatus(userId, { title: text });
    if (String(state.isDetailed) === 'true') {
      sendMeetChoice(replyToken);
    } else {
      // 直後の読み込みエラーを防ぐため内容を直接渡す
      sendReply(replyToken, finalizeRegistration(userId, text, writeLog));
    }
    return;
  }
  sendReply(replyToken, "メニューを押すか「明日の予定」と送ってください。");
}

function finalizeRegistration(userId, directTitle, writeLog) {
  const ss = SpreadsheetApp.openById(SS_ID);
  SpreadsheetApp.flush(); // 保存状態を強制同期
  
  const state = getStatus(userId);
  const pref = getUserPref(userId);
  const calendarId = getCalendarId(ss);
  const title = directTitle || (state ? state.title : "");

  writeLog("【登録実況】", `名前:${title} / カレンダー:${calendarId}`);

  if (!title) return "【失敗】名前がありません。再度入力してください。";
  if (!calendarId) return "【失敗】設定シートのB1セルに正しいアドレスを入れてください。";

  try {
    const dateStr = String(state.date);
    const start = new Date(dateStr.replace(/-/g, '/').replace('T', ' '));
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    let meetUrl = "";
    if (state.meet === 'yes') {
      writeLog("【判断】", "Meetリンクを発行します...");
      const eventJson = {
        summary: title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
      };
      // Calendar APIを使用（リソースから追加されている必要あり）
      const created = Calendar.Events.insert(eventJson, calendarId, { conferenceDataVersion: 1 });
      meetUrl = created.hangoutLink;
    } else {
      const calendar = CalendarApp.getCalendarById(calendarId);
      if (!calendar) throw new Error("カレンダーにアクセスできません。IDを確認してください。");
      const event = calendar.createEvent(title, start, end);
      const mins = parseInt(pref.remTime) || 10;
      if (mins > 0) event.addPopupReminder(mins);
    }
    
    clearStatus(userId);
    const successMsg = `✅登録完了\n${dateStr.replace('T', ' ')} ${title}${meetUrl ? '\n🔗' + meetUrl : ''}`;
    writeLog("【成功】", successMsg);
    return successMsg;
  } catch (e) {
    writeLog("【失敗】", e.message);
    return "【登録失敗】" + e.message + "\n※Calendar APIが有効か確認してください。";
  }
}

function getSchedule(range) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const calendarId = getCalendarId(ss);
  const now = new Date();
  let start, end;
  if (range === 'tomorrow') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
  } else if (range === 'week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }
  try {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) return "カレンダーIDが間違っています。";
    const events = calendar.getEvents(start, end);
    if (events.length === 0) return "予定なし";
    let msg = "";
    events.forEach(e => {
      msg += `${Utilities.formatDate(e.getStartTime(), 'JST', 'MM/dd HH:mm')} ${e.getTitle()}\n`;
    });
    return msg.trim();
  } catch (e) { return "取得エラー"; }
}

function getCalendarId(ss) {
  const sheet = ss.getSheetByName('設定');
  if (sheet) {
    const b1 = sheet.getRange('B1').getValue().toString().trim();
    if (b1.includes('@')) return b1;
  }
  return ""; 
}

// --- ボタン送信部品（正規テンプレート形式） ---

function sendMonthSelection(replyToken) {
  const payload = {
    'replyToken': replyToken,
    'messages': [{
      'type': 'template', 'altText': '月を選択',
      'template': {
        'type': 'buttons', 'text': 'いつの予約ですか？',
        'actions': [
          { 'type': 'postback', 'label': '今月', 'data': 'action=choose_month=now' },
          { 'type': 'postback', 'label': '来月', 'data': 'action=choose_month=next' },
          { 'type': 'postback', 'label': '任意', 'data': 'action=choose_month=manual' }
        ]
      }
    }]
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_TOKEN },
    'method': 'post', 'payload': JSON.stringify(payload)
  });
}

function sendDateTimePicker(replyToken, type) {
  const now = new Date();
  let initial = Utilities.formatDate(now, 'JST', "yyyy-MM-dd'T'HH:mm");
  if (type === 'next') initial = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth()+1, 1, 10, 0), 'JST', "yyyy-MM-dd'T'HH:mm");
  
  const payload = {
    'replyToken': replyToken,
    'messages': [{
      'type': 'template', 'altText': '日時選択',
      'template': {
        'type': 'buttons', 'text': '日時を選んでください',
        'actions': [
          { 'type': 'datetimepicker', 'label': '日時を確定', 'data': 'action=select_date', 'mode': 'datetime', 'initial': initial }
        ]
      }
    }]
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_TOKEN },
    'method': 'post', 'payload': JSON.stringify(payload)
  });
}

function sendSettingsMenu(replyToken) {
  const payload = {
    'replyToken': replyToken,
    'messages': [
      {
        'type': 'template', 'altText': '設定1',
        'template': {
          'type': 'buttons', 'text': '通知種類を選んでください',
          'actions': [
            { 'type': 'postback', 'label': 'LINE通知', 'data': 'action=set_rem_type=line' },
            { 'type': 'postback', 'label': 'Google通知', 'data': 'action=set_rem_type=google' }
          ]
        }
      },
      {
        'type': 'template', 'altText': '設定2',
        'template': {
          'type': 'buttons', 'text': '通知時間を選んでください',
          'actions': [
            { 'type': 'postback', 'label': '10分前', 'data': 'action=set_rem_time=10' },
            { 'type': 'postback', 'label': '30分前', 'data': 'action=set_rem_time=30' },
            { 'type': 'postback', 'label': '60分前', 'data': 'action=set_rem_time=60' }
          ]
        }
      }
    ]
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_TOKEN },
    'method': 'post', 'payload': JSON.stringify(payload)
  });
}

function sendMeetChoice(replyToken) {
  const payload = {
    'replyToken': replyToken,
    'messages': [{
      'type': 'template', 'altText': 'Meet要否',
      'template': {
        'type': 'buttons', 'text': 'Google Meetを発行しますか？',
        'actions': [
          { 'type': 'postback', 'label': 'はい', 'data': 'action=set_meet=yes' },
          { 'type': 'postback', 'label': 'いいえ', 'data': 'action=set_meet=no' }
        ]
      }
    }]
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_TOKEN },
    'method': 'post', 'payload': JSON.stringify(payload)
  });
}

// --- 共通部品 ---

function updateStatus(userId, updates) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName('一時保存') || ss.insertSheet('一時保存');
  const headers = ['userId', 'date', 'status', 'isDetailed', 'title', 'meet'];
  const data = sheet.getDataRange().getValues();
  if (!data[0] || data[0].length === 0) sheet.appendRow(headers);
  let rowIndex = -1;
  const vals = sheet.getDataRange().getValues();
  for (let i=1; i<vals.length; i++) { if (vals[i][0] === userId) { rowIndex = i+1; break; } }
  if (rowIndex === -1) { sheet.appendRow([userId]); rowIndex = sheet.getLastRow(); }
  for (let key in updates) { 
    let col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowIndex, col).setValue(updates[key]);
  }
  SpreadsheetApp.flush();
}

function getStatus(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('一時保存');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i=1; i<data.length; i++) { if (data[i][0] === userId) {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = data[i][idx]; });
    return obj;
  } }
  return null;
}

function clearStatus(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('一時保存');
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i=1; i<data.length; i++) { if (data[i][0] === userId) { sheet.deleteRow(i+1); break; } }
  }
  SpreadsheetApp.flush();
}

function saveUserPref(userId, key, val) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName('ユーザー設定') || ss.insertSheet('ユーザー設定');
  const data = sheet.getDataRange().getValues();
  if (!data[0] || data[0].length === 0) sheet.appendRow(['userId', 'remType', 'remTime']);
  let row = -1;
  const vals = sheet.getDataRange().getValues();
  for (let i=1; i<vals.length; i++) { if (vals[i][0] === userId) { row = i+1; break; } }
  if (row === -1) { sheet.appendRow([userId]); row = sheet.getLastRow(); }
  const col = (key === 'remTime') ? 3 : 2;
  sheet.getRange(row, col).setValue(val);
  SpreadsheetApp.flush();
}

function getUserPref(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('ユーザー設定');
  if (!sheet) return { remType: 'google', remTime: 10 };
  const data = sheet.getDataRange().getValues();
  for (let i=1; i<data.length; i++) { if (data[i][0] === userId) return { remType: data[i][1], remTime: data[i][2] }; }
  return { remType: 'google', remTime: 10 };
}

function sendReply(replyToken, msg) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_TOKEN },
    'method': 'post', 'payload': JSON.stringify({ 'replyToken': replyToken, 'messages': [{'type': 'text', 'text': msg}] })
  });
}
