/**
 * 【LINEスケジュール：最終完成版 Ver 3.2】
 * 
 * ・機能: お問い合わせURLをスプレッドシート「設定」シートのB2セルから取得
 * ・安定: プロパティサービスによる高速・正確な予約登録
 * ・管理: ユーザー増減・入力ログの自動記録
 */

// --- システム設定 ---
const LINE_TOKEN = 'iR7vPwaizF+JujidhAQxaq/jhzCCt+Ded1cnmXeTECqjzRusOF+rArPq1h8bIBs/MhpzqZ36JVNHHeC/viTPblbrDCH4kWjQEsL/FkkwTNl/Ig1bBoChfQPxbACBFKsdJVL011VeYI3xfFP4dndvBgdB04t89/1O/w1cDnyilFU=';
const SS_ID = '1mAF7tkUQynLdpNTH_spOyRp56sTz7Cg-e2NE70LybVs'; 

const TEST_MODE = true; 
const LOG_MAX_ROWS = 5000;
const LOG_TRIM_COUNT = 500;

function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents);
    if (!json.events || json.events.length === 0) return ContentService.createTextOutput("OK");
    
    writeLog("【受信】", json);
    const event = json.events[0];
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    if (event.type === 'follow') {
      recordUserChange(userId, '有効');
      sendReply(replyToken, "友だち登録ありがとうございます！\n「かんたん予約」と入力すると、すぐに予約を始められます。");
      return ContentService.createTextOutput("OK");
    }
    if (event.type === 'unfollow') {
      recordUserChange(userId, '解除');
      return ContentService.createTextOutput("OK");
    }

    const userInfo = getUserPlan(userId);
    dispatchAction(event, userId, replyToken, userInfo, writeLog);

  } catch (err) {
    writeLog("【致命的大エラー】", err.message);
  }
  return ContentService.createTextOutput("OK");
}

/**
 * ログ記録（自動ローテーション・エラー分離対応）
 */
function writeLog(tag, msg) {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const logData = [new Date(), tag, typeof msg === 'object' ? JSON.stringify(msg) : msg];
    
    // 1. 通常ログへの記録
    let logSheet = ss.getSheetByName('ログ') || ss.insertSheet('ログ');
    logSheet.appendRow(logData);
    
    // 2. 自動ローテーション（行数制限）
    const lastRow = logSheet.getLastRow();
    if (lastRow > LOG_MAX_ROWS) {
      // 1行目の見出し等は適宜考慮（現在は見出しなし想定だが、1行目から削除）
      logSheet.deleteRows(1, LOG_TRIM_COUNT);
      // ローテーションした旨を記録
      logSheet.appendRow([new Date(), "【システム】", `ログを${LOG_TRIM_COUNT}行削除しました（上限${LOG_MAX_ROWS}行超過のため）`]);
    }

    // 3. エラーログの分離
    if (tag.includes('エラー') || tag.includes('失敗') || tag.includes('致命的')) {
      let errSheet = ss.getSheetByName('エラー履歴') || ss.insertSheet('エラー履歴');
      if (errSheet.getLastRow() === 0) {
        errSheet.appendRow(['日時', '区分', '内容']); // ヘッダー
      }
      errSheet.appendRow(logData);
    }
  } catch (err) {
    console.error("ログ記録失敗:", err);
  }
}

function recordUserChange(userId, status) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName('ユーザー推移') || ss.insertSheet('ユーザー推移');
  if (sheet.getLastRow() === 0) sheet.appendRow(['日付', 'ラインID', 'ステータス']);
  sheet.appendRow([Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm'), userId, status]);
}

function dispatchAction(event, userId, replyToken, userInfo, writeLog) {
  if (event.type === 'postback') {
    const data = event.postback.data;
    
    if (data.startsWith('action=select_date')) {
      handleDateSelection(replyToken, userId, event.postback.params.datetime, writeLog);
    } 
    else if (data === 'action=confirm_dupe_yes') {
      updateStatus(userId, { status: 'WAIT_FOR_TITLE' }, writeLog);
      sendReply(replyToken, "重複了解しました。\n予定タイトルをご入力ください。");
    } 
    else if (data === 'action=confirm_dupe_no') {
      clearStatus(userId); sendReply(replyToken, "キャンセルしました。");
    } 
    else if (data.startsWith('action=set_duration_picker')) {
      const timeStr = event.postback.params.time;
      updateStatus(userId, { duration: timeStr }, writeLog);
      
      const [h, m] = timeStr.split(':').map(n => parseInt(n));
      const label = (h === 0 && m === 0) ? "終日" : `${h > 0 ? h + '時間' : ''}${m}分`;
      const confirmText = `✅ [${label}] に設定しました。`;
      
      const state = getStatus(userId);
      if (state && String(state.isDetailed) === 'true') {
        sendMeetChoiceFlex(replyToken, confirmText);
      } else {
        sendReply(replyToken, confirmText + "\n\n登録を完了します...");
        sendPushMessage(userId, finalizeRegistration(userId, userInfo, writeLog));
      }
    }
    else if (data.startsWith('action=set_meet')) {
      updateStatus(userId, { meet: data.split('=')[2] }, writeLog);
      sendReply(replyToken, finalizeRegistration(userId, userInfo, writeLog));
    }
    return;
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    const state = getStatus(userId);

    if (state && state.status === 'WAIT_FOR_TITLE') {
      updateStatus(userId, { title: text }, writeLog);
      sendDurationPicker(replyToken);
      return;
    }

    // 管理者コマンド
    if (text === '!システムログ削除' && TEST_MODE) {
      clearLogs();
      sendReply(replyToken, "✅システムログをクリアしました。");
      return;
    }

    const isWeekReq = text.includes('1週間') || text.includes('１週間') || text.includes('一週間');

    if (text === 'かんたん予約') {
      updateStatus(userId, { isDetailed: 'false', status: 'SELECT_MONTH', meet: 'no' }, writeLog);
      sendMonthSelectionFlex(replyToken);
    } else if (text === 'こだわり予約') {
      updateStatus(userId, { isDetailed: 'true', status: 'SELECT_MONTH', meet: 'no' }, writeLog);
      sendMonthSelectionFlex(replyToken);
    } else if (text.includes('今日')) {
      sendReply(replyToken, getSchedule('today', userInfo));
    } else if (text.includes('明日')) {
      sendReply(replyToken, getSchedule('tomorrow', userInfo));
    } else if (isWeekReq) {
      sendReply(replyToken, getSchedule('week', userInfo));
    } else if (text === 'お問い合わせ') {
      sendInquiryMenu(replyToken);
    } else {
      sendReply(replyToken, "「かんたん予約」や「今日の予定」とお送りください。");
    }
  }
}

function getSchedule(range, userInfo) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const calendarId = getCalendarId(ss);
  const now = new Date();
  let start, end, label;
  if (range === 'tomorrow') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
    label = "[明日の予定]";
  } else if (range === 'week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
    label = "[1週間の予定]";
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    label = "[今日の予定]";
  }
  try {
    const events = CalendarApp.getCalendarById(calendarId).getEvents(start, end);
    if (events.length === 0) return label + "\n\nなし";
    let msg = label + "\n\n";
    let lastDate = "";
    events.forEach(e => {
      const st = e.getStartTime();
      const dt = Utilities.formatDate(st, 'JST', 'MM/dd');
      if (dt !== lastDate) { if (lastDate !== "") msg += "────────────\n"; lastDate = dt; }
      msg += `【${formatDateWithWeek(st)}】\n${e.getTitle()}\n\n`; 
    });
    return msg;
  } catch (err) { return "予定を取得できませんでした。"; }
}

function sendDurationPicker(replyToken) {
  callLineAPI(replyToken, [{
    "type": "text", "text": "⏱ 所要時間を設定してください\n(00:00を選択すると『終日予定』になります)",
    "quickReply": { "items": [{ "type": "action", "action": { "type": "datetimepicker", "label": "時間を設定", "data": "action=set_duration_picker", "mode": "time", "initial": "00:30" } }]}
  }]);
}

function sendMonthSelectionFlex(replyToken) {
  const now = new Date();
  const minDate = formatDateWithWeek(now, true);
  const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
    { "type": "text", "text": "いつのご予約でしょうか？", "weight": "bold", "size": "md" },
    { "type": "box", "layout": "horizontal", "spacing": "sm", "margin": "md", "contents": [
      { "type": "button", "height": "sm", "style": "primary", "action": { "type": "datetimepicker", "label": "今月", "data": "action=select_date", "mode": "datetime", "initial": minDate, "min": minDate } },
      { "type": "button", "height": "sm", "style": "primary", "action": { "type": "datetimepicker", "label": "来月", "data": "action=select_date", "mode": "datetime", "initial": formatDateWithWeek(new Date(now.getFullYear(), now.getMonth()+1, 1, 10, 0), true), "min": minDate } },
      { "type": "button", "height": "sm", "style": "primary", "action": { "type": "datetimepicker", "label": "任意", "data": "action=select_date", "mode": "datetime", "initial": formatDateWithWeek(new Date(now.getFullYear(), now.getMonth()+2, 1, 10, 0), true), "min": minDate } }
    ]}
  ]}};
  callLineAPI(replyToken, [{ "type": "flex", "altText": "日時選択", "contents": flex }]);
}

function handleDateSelection(replyToken, userId, selDate, writeLog) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const calendarId = getCalendarId(ss);
  const selectedTime = new Date(selDate.replace(/-/g, '/').replace('T', ' '));
  const end = new Date(selectedTime.getTime() + 60 * 60 * 1000);
  const events = CalendarApp.getCalendarById(calendarId).getEvents(selectedTime, end);
  updateStatus(userId, { date: selDate }, writeLog);
  if (events.length > 0) {
    const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
      { "type": "text", "text": "🚨予定が重複しております。登録しますか？", "wrap": true, "weight": "bold" },
      { "type": "box", "layout": "horizontal", "spacing": "sm", "margin": "lg", "contents": [
        { "type": "button", "style": "primary", "action": { "type": "postback", "label": "はい", "data": "action=confirm_dupe_yes" } },
        { "type": "button", "style": "secondary", "action": { "type": "postback", "label": "いいえ", "data": "action=confirm_dupe_no" } }
      ]}
    ]}};
    callLineAPI(replyToken, [{ "type": "flex", "altText": "重複確認", "contents": flex }]);
  } else {
    updateStatus(userId, { status: 'WAIT_FOR_TITLE' }, writeLog);
    sendReply(replyToken, `【日時確定】${formatDateWithWeek(selectedTime)}\n予定タイトルを入力してください。`);
  }
}

function finalizeRegistration(userId, userInfo, writeLog) {
  const state = getStatus(userId);
  const ss = SpreadsheetApp.openById(SS_ID);
  const calendarId = getCalendarId(ss);
  if (!state) return "タイムアウトしました。最初からやり直してください。";
  
  try {
    let start = (state.date instanceof Date) ? state.date : new Date(String(state.date).replace(/-/g, '/').replace('T', ' '));
    const title = state.title;
    const durationStr = state.duration || '00:30';
    const [h, m] = durationStr.split(':').map(n => parseInt(n));
    const totalMins = h * 60 + m;
    
    writeLog("【登録実行】", { userId: userId, duration: durationStr, mins: totalMins });

    let meetUrl = "";
    if (totalMins === 0) {
       CalendarApp.getCalendarById(calendarId).createAllDayEvent(title, start);
    } else {
       const end = new Date(start.getTime() + totalMins * 60000);
       if (state.meet === 'yes' && typeof Calendar !== 'undefined') {
         try {
           const eventJson = { summary: title, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } };
           meetUrl = Calendar.Events.insert(eventJson, calendarId, { conferenceDataVersion: 1 }).hangoutLink;
         } catch (e) { writeLog("【Meetエラー】", e.message); }
       }
       if (!meetUrl) CalendarApp.getCalendarById(calendarId).createEvent(title, start, end);
    }
    clearStatus(userId);
    const label = totalMins === 0 ? '（終日）' : `（${h > 0 ? h + '時間' : ''}${m}分間）`;
    return `✅予約完了\n${formatDateWithWeek(start)}${label}\n${title}${meetUrl ? '\n🔗' + meetUrl : ''}`;
  } catch (e) { 
    writeLog("【最終登録失敗】", e.message);
    return "登録失敗:" + e.message; 
  }
}

function formatDateWithWeek(date, isISO) {
  const week = ['日','月','火','水','木','金','土'][date.getDay()];
  if (isISO) return Utilities.formatDate(date, 'JST', "yyyy-MM-dd'T'HH:mm");
  return Utilities.formatDate(date, 'JST', `MM/dd (${week}) HH:mm`);
}

function updateStatus(userId, updates, writeLog) {
  const props = PropertiesService.getUserProperties();
  let current = props.getProperty(userId);
  let state = current ? JSON.parse(current) : {};
  for (let key in updates) { state[key] = updates[key]; }
  props.setProperty(userId, JSON.stringify(state));
  if (writeLog) writeLog("【状態更新】", updates);
}

function getStatus(userId) {
  const props = PropertiesService.getUserProperties();
  const current = props.getProperty(userId);
  return current ? JSON.parse(current) : null;
}

function clearStatus(userId) {
  const props = PropertiesService.getUserProperties();
  props.deleteProperty(userId);
}

function getCalendarId(ss) {
  const sheet = ss.getSheetByName('設定');
  if (sheet) { 
    const val = sheet.getRange('B1').getValue().toString(); 
    if (val.includes('@')) return val; 
  }
  return ""; 
}

function getInquiryUrl(ss) {
  const sheet = ss.getSheetByName('設定');
  if (sheet) { 
    const val = sheet.getRange('B2').getValue().toString(); 
    if (val.startsWith('http')) return val; 
  }
  return "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform"; // デフォルト
}

function sendInquiryMenu(replyToken) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const url = getInquiryUrl(ss);
  callLineAPI(replyToken, [{ 'type': 'template', 'altText': 'お問合せ', 'template': { 'type': 'buttons', 'text': 'ご連絡をお待ちしております', 'actions': [{ 'type': 'uri', 'label': 'フォームを開く', 'uri': url }] } }]);
}

function getUserPlan(userId) { return { plan: TEST_MODE ? 'Pro' : 'None', regCount: 0 }; }
function callLineAPI(replyToken, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_TOKEN },
    'method': 'post', 'payload': JSON.stringify({ 'replyToken': replyToken, 'messages': messages })
  });
}
function sendReply(replyToken, msg) { callLineAPI(replyToken, [{ 'type': 'text', 'text': msg }]); }
function sendPushMessage(userId, msg) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_TOKEN },
    'method': 'post', 'payload': JSON.stringify({ 'to': userId, 'messages': [{'type': 'text', 'text': msg}] })
  });
}
function sendMeetChoiceFlex(replyToken, confirmText) {
  const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
    { "type": "text", "text": confirmText, "size": "sm", "color": "#1db446", "weight": "bold" },
    { "type": "text", "text": "Google Meetを発行しますか？", "weight": "bold", "margin": "md" },
    { "type": "box", "layout": "horizontal", "spacing": "sm", "margin": "md", "contents": [
      { "type": "button", "style": "primary", "action": { "type": "postback", "label": "はい", "data": "action=set_meet=yes" } },
      { "type": "button", "style": "secondary", "action": { "type": "postback", "label": "いいえ", "data": "action=set_meet=no" } }
    ]}
  ]}};
  callLineAPI(replyToken, [{ "type": "flex", "altText": "Meet設定", "contents": flex }]);
}

/**
 * ログの手動クリア
 */
function clearLogs() {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const sheet = ss.getSheetByName('ログ');
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 0) {
        sheet.deleteRows(1, lastRow);
      }
      sheet.appendRow([new Date(), "【システム】", "ログを手動でクリアしました。"]);
    }
  } catch (err) {
    console.error("ログクリア失敗:", err);
  }
}
