/*******************************************************************************
 * 【勤怠管理システム】 GASメインスクリプト
 * 
 * 役割ごとにモジュール化：
 * 1. LINE通信・イベント受取 (doPost / handleEvent)
 * 2. ユーザー管理・名前解決 (User Manager)
 * 3. ログ記録 (Logger)
 * 4. データ更新 (Master / Shift Table Logic)
 * 
 ******************************************************************************/

/******************** ▼ CONFIGURATION ▼ ********************/
const CONFIG = {
  // ❶ スプレッドシートの URL 全文
  SPREADSHEET_URL : 'https://docs.google.com/spreadsheets/d/15mdta0mkqDjYBBfcaC7-hf7PxTVa9tB5MibpOqC7WsM/edit?gid=758095427#gid=758095427',

  // ❷ LINE チャネルアクセストークン
  LINE_TOKEN      : '', // セキュリティ保護のため 90_Secrets/secrets.json へ移動済み

  // ❸ 通知を送りたいグループ ID
  ADMIN_GROUP_ID  : 'C8ec7f01e98cfb835411b55c04c816417',

  TIMEZONE        : 'Asia/Tokyo'
};

const SHEETS = {
  LOG         : 'ログ',
  RAW_LOG     : '生ログ', // イベント生データ用
  MASTER      : 'マスタ',
  USER_MASTER : 'ユーザーマスタ',
  SETTINGS    : '人数設定',
  ERROR       : 'エラーログ',
  PATTERN     : 'パターンマスター'
};

/******************** 1. Webアプリ表示・LINE 通信 ********************/

/**
 * Webアプリを表示する (doGet)
 */
function doGet(e) {
  const userId = e.parameter.userId || "";
  const template = HtmlService.createTemplateFromFile('index');
  template.userId = userId;
  
  // パターンマスターからチーム・時間帯の選択肢を取得
  try {
    const ss = openSS();
    const sheet = ss.getSheetByName(SHEETS.PATTERN);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const patterns = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        template.patterns = patterns.map(r => ({ label: r[0], team: r[1], time: r[2] }));
      } else {
        template.patterns = [];
      }
    }
  } catch (err) {
    template.patterns = [];
  }
  
  return template.evaluate()
    .setTitle('シフト登録システム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Webページからのシフト登録を処理
 */
function submitShift(data) {
  try {
    const { userId, startDate, endDate, patternIdx } = data;
    const displayName = getDisplayName(userId);
    
    const ss = openSS();
    const patSheet = ss.getSheetByName(SHEETS.PATTERN);
    const pattern = patSheet.getRange(parseInt(patternIdx) + 2, 1, 1, 3).getValues()[0];
    const [label, team, timeSlot] = pattern;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const rows = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd');
      rows.push([dateStr, timeSlot, team, displayName, 'confirmed']);
    }

    const masSh = ss.getSheetByName(SHEETS.MASTER);
    if (rows.length > 0) {
      masSh.getRange(masSh.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
    }

    // 過不足計算
    recalcAndNotify();

    return { success: true };
  } catch (err) {
    logError(err, 'submitShift');
    return { success: false, message: err.message };
  }
}

/**
 * LINEからのWebhookを受け取る
 */
function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    contents.events.forEach(event => {
      // 1. まずは全てのイベントを生ログに記録
      recordRawLog(event);
      // 2. イベント処理
      handleEvent(event);
    });
    return ContentService.createTextOutput('ok');
  } catch (err) {
    logError(err, 'doPost');
    return ContentService.createTextOutput('error');
  }
}

/**
 * 個別のイベントを解析して各処理へ振り分け
 */
function handleEvent(ev) {
  try {
    const userId = ev.source.userId;
    const targetId = ev.source.groupId || ev.source.userId || ev.source.roomId;
    
    // 表示名の解決 (IDではなく名前を使う)
    const displayName = getDisplayName(userId);

    /* --- groupId 告知 (初期設定用) --- */
    if (!CONFIG.ADMIN_GROUP_ID && ev.source.type === 'group') {
      pushLine(targetId, 'groupId = ' + ev.source.groupId + '\nCONFIG.ADMIN_GROUP_ID に設定してください');
    }

    /* --- メニュー・ポストバック処理 --- */
    
    // 1. シフト登録URLの案内
    if (ev.message?.type === 'text' && ev.message.text === '登録') {
      const url = ScriptApp.getService().getUrl() + "?userId=" + userId;
      pushLine(targetId, "以下のリンクからシフトを入力してください：\n" + url);
      return;
    }

    // 2. まとめ登録メニュー表示（旧互換用）
    if (ev.message?.type === 'text' && ev.message.text === 'まとめ登録') {
      showBulkMenu(targetId);
      return;
    }

    // 2. ポストバック分岐
    if (ev.type === 'postback') {
      handlePostback(ev, userId, displayName, targetId);
      return;
    }

    // 3. 通常テキストメッセージ (シフト登録)
    if (ev.message?.type === 'text') {
      const msg = ev.message.text.trim();
      processShiftRequest(userId, displayName, msg, ev.source.groupId || '');
    }

  } catch (err) {
    logError(err, 'handleEvent');
    const targetId = ev.source.groupId || ev.source.userId;
    if (targetId) pushLine(targetId, '⚠️ エラーが発生しました。');
  }
}

/**
 * ポストバックイベントの処理
 */
function handlePostback(ev, userId, displayName, targetId) {
  const data = ev.postback.data;
  let st = getUserState(userId);

  if (data === 'BULK=WEEK') {
    pushLine(targetId, qr([{type:'action',action:{type:'datetimepicker',label:'週の月曜日を選択',data:'WKSTART',mode:'date'}}]));
  } 
  else if (data === 'WKSTART') {
    const monday = new Date(ev.postback.params.date);
    const week = [...Array(7)].map((_, i) => fmt(addDays(monday, i)));
    sendPatternButtons(week, targetId);
  } 
  else if (data === 'BULK=MONTH') {
    pushLine(targetId, qr([{type:'action',action:{type:'datetimepicker',label:'月を選択',data:'MONTHSEL',mode:'date'}}]));
  } 
  else if (data === 'MONTHSEL') {
    const first = new Date(ev.postback.params.date);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const arr = [...Array(days)].map((_, i) => fmt(addDays(first, i)));
    sendPatternButtons(arr, targetId);
  } 
  else if (data === 'BULK=PERIOD') {
    setUserState(userId, {});
    pushLine(targetId, qr([{type:'action',action:{type:'datetimepicker',label:'開始日を選択',data:'P_START',mode:'date'}}]));
  } 
  else if (data === 'P_START') {
    st.pStart = ev.postback.params.date; 
    setUserState(userId, st);
    pushLine(targetId, qr([{type:'action',action:{type:'datetimepicker',label:'終了日を選択',data:'P_END',mode:'date'}}]));
  } 
  else if (data === 'P_END') {
    const a = new Date(getUserState(userId).pStart);
    const b = new Date(ev.postback.params.date);
    const arr = []; for (let d = a; d <= b; d = addDays(d, 1)) arr.push(fmt(d));
    sendPatternButtons(arr, targetId);
    setUserState(userId, {});
  } 
  else if (data.startsWith('BATCH&')) {
    const p = parseQuery(data.replace('BATCH&', ''));
    processBatchRegistration(userId, displayName, p, targetId, ev.source.groupId || '');
  }
}

/**
 * LINE Messaging API (Push)
 */
function pushLine(to, message) {
  if (!to) return;
  const msg = typeof message === 'string' ? { type: 'text', text: message } : message;
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${CONFIG.LINE_TOKEN}` },
      payload: JSON.stringify({ to, messages: [msg] })
    });
  } catch (e) {
    logError(e, 'pushLine to: ' + to);
  }
}

/******************** 2. ユーザー管理・名前解決 (User Manager) ********************/

/**
 * LINE UserID から表示名を取得（キャッシュ・マスタ併用）
 */
function getDisplayName(userId) {
  if (!userId) return 'Unknown';

  const cache = CacheService.getScriptCache();
  const cachedName = cache.get("USER_NAME_" + userId);
  if (cachedName) return cachedName;

  // スプレッドシートのマスタを確認
  const ss = openSS();
  let sh = ss.getSheetByName(SHEETS.USER_MASTER);
  if (!sh) {
    sh = ss.insertSheet(SHEETS.USER_MASTER);
    sh.appendRow(['userId', 'displayName', 'lastUpdated']);
  }
  
  const data = sh.getDataRange().getValues();
  const userRow = data.find(r => r[0] === userId);
  
  if (userRow) {
    cache.put("USER_NAME_" + userId, userRow[1], 21600); // 6時間キャッシュ
    return userRow[1];
  }

  // APIから取得
  try {
    const url = 'https://api.line.me/v2/bot/profile/' + userId;
    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: `Bearer ${CONFIG.LINE_TOKEN}` }
    });
    const profile = JSON.parse(res.getContentText());
    const name = profile.displayName;

    // マスタに保存
    sh.appendRow([userId, name, new Date()]);
    cache.put("USER_NAME_" + userId, name, 21600);
    return name;
  } catch (e) {
    console.error('getDisplayName failed: ' + e.message);
    return userId; // 取得失敗時はIDを返す
  }
}

function getUserState(id) {
  const v = CacheService.getScriptCache().get('ST_' + id);
  return v ? JSON.parse(v) : {};
}

function setUserState(id, o) {
  CacheService.getScriptCache().put('ST_' + id, JSON.stringify(o), 600);
}

/******************** 3. ログ記録 (Logger) ********************/

/**
 * 全てのWebhookイベントを「生ログ」シートに記録
 */
function recordRawLog(event) {
  try {
    const ss = openSS();
    let sh = ss.getSheetByName(SHEETS.RAW_LOG);
    if (!sh) {
      sh = ss.insertSheet(SHEETS.RAW_LOG);
      sh.appendRow(['timestamp', 'type', 'userId', 'data']);
    }
    const timestamp = new Date();
    const type = event.type;
    const userId = event.source.userId;
    const data = JSON.stringify(event);
    sh.appendRow([timestamp, type, userId, data]);
  } catch (e) {
    console.error('recordRawLog failed: ' + e.message);
  }
}

/**
 * シフト登録の処理履歴を「ログ」シートに記録
 */
function appendProcessLog({ts, displayName, msg, gid}) {
  try {
    const sh = openSS().getSheetByName(SHEETS.LOG);
    sh.appendRow([ts, displayName, msg, gid, '', '未処理']);
    
    const row = sh.getLastRow();
    if (!parseMsg(msg, '')) {
      sh.getRange(row, 7).setValue('形式エラー');
    }
  } catch (err) {
    logError(err, 'appendProcessLog');
  }
}

function logError(err, where) {
  try {
    const ss = openSS();
    const sh = ss.getSheetByName(SHEETS.ERROR) || ss.insertSheet(SHEETS.ERROR);
    sh.appendRow([new Date(), where, err.message, err.stack]);
  } catch (e) {
    console.error('logError failed: ' + e.message);
  }
}

/******************** 4. データ更新・ビジネスロジック ********************/

/**
 * 単発のテキストメッセージを処理
 */
function processShiftRequest(userId, displayName, msg, groupId) {
  appendProcessLog({ts: new Date(), displayName: displayName, msg: msg, gid: groupId});
  updateMaster();
  recalcAndNotify();
}

/**
 * 一括登録（ポストバック）を処理
 */
function processBatchRegistration(userId, displayName, params, targetId, groupId) {
  const { team, time, dates } = params;
  const dateList = (dates || '').split('|');

  if (!team || !time || !dateList.length) {
    pushLine(targetId, '❌ データ解析に失敗しました。');
    return;
  }

  dateList.forEach(d => {
    const formattedDate = Utilities.formatDate(new Date(d), CONFIG.TIMEZONE, 'M/d');
    const msg = `${formattedDate} ${time.replace(':00','')} ${team} 希望`;
    appendProcessLog({ts: new Date(), displayName: displayName, msg: msg, gid: groupId});
  });

  updateMaster();
  recalcAndNotify();
  pushLine(targetId, `✅ ${dateList.length}日分 (${team}) を登録しました`);
}

/**
 * ログシートからマスタシートを再構築
 */
function updateMaster() {
  try {
    const ss = openSS();
    const logSh = ss.getSheetByName(SHEETS.LOG);
    const logData = logSh.getDataRange().getValues();
    
    // 形式エラーを除外して解析
    const latest = {};
    for (let i = logData.length - 1; i >= 1; i--) {
      const [ts, displayName, msg, gid, teamCell, status] = logData[i];
      if (status === '形式エラー') continue;

      const p = parseMsg(msg, teamCell);
      if (!p) continue;

      // キー: 日付|時間|チーム|表示名 (重複排除)
      const key = [p.date, p.time, p.team, displayName].join('|');
      if (!latest[key]) {
        latest[key] = { ...p, user: displayName };
      }
    }

    const masSh = ss.getSheetByName(SHEETS.MASTER);
    masSh.clearContents().appendRow(['date', 'time', 'team', 'user', 'status']);
    
    const rows = Object.values(latest).map(r => [r.date, r.time, r.team, r.user, 'confirmed']);
    if (rows.length > 0) {
      masSh.getRange(2, 1, rows.length, 5).setValues(rows);
    }
  } catch (err) {
    logError(err, 'updateMaster');
  }
}

/**
 * 過不足を計算して管理グループに通知
 */
function recalcAndNotify() {
  try {
    const ss = openSS();
    const masData = ss.getSheetByName(SHEETS.MASTER).getDataRange().getValues();
    const setData = ss.getSheetByName(SHEETS.SETTINGS).getDataRange().getValues();
    
    const need = {};
    const have = {};

    // 必要人数の集計
    for (let i = 1; i < setData.length; i++) {
      const [d, t, team, req] = setData[i];
      const key = [fmt(new Date(d)), t, team].join('|');
      need[key] = req;
    }

    // 現在人数の集計
    for (let i = 1; i < masData.length; i++) {
      const [d, t, team] = masData[i];
      const key = [fmt(new Date(d)), t, team].join('|');
      have[key] = (have[key] || 0) + 1;
    }

    const alerts = [];
    Object.keys(need).forEach(k => {
      const diff = (have[k] || 0) - need[k];
      if (diff === 0) return;
      const [d, t, team] = k.split('|');
      alerts.push(`${d} ${t} ${team} ${diff < 0 ? Math.abs(diff)+'名不足' : diff+'名超過'}`);
    });

    if (alerts.length && CONFIG.ADMIN_GROUP_ID) {
      pushLine(CONFIG.ADMIN_GROUP_ID, "【人数過不足通知】\n" + alerts.join('\n'));
    }
  } catch (err) {
    logError(err, 'recalcAndNotify');
  }
}

/******************** 共通ユーティリティ ********************/

function openSS() {
  let id = CONFIG.SPREADSHEET_URL.trim();
  const m = id.match(/\/d\/([\w-]+)/);
  id = m ? m[1] : id;
  return SpreadsheetApp.openById(id);
}

function parseMsg(msg, teamCell) {
  const re = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2})[-:](\d{1,2})(?:\s+(\w+))?/;
  const m = msg.match(re);
  if (!m) return null;
  const yr = new Date().getFullYear();
  const date = fmt(new Date(yr, m[1] - 1, m[2]));
  const team = m[5] || teamCell || 'Default';
  return { date, time: `${m[3]}:00-${m[4]}:00`, team };
}

function parseQuery(queryString) {
  const params = {};
  queryString.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key) params[key] = decodeURIComponent(value || '');
  });
  return params;
}

function showBulkMenu(targetId) {
  pushLine(targetId, qr([
    {type:'action',action:{type:'postback',label:'週まとめ', data:'BULK=WEEK'}},
    {type:'action',action:{type:'postback',label:'1か月まとめ',data:'BULK=MONTH'}},
    {type:'action',action:{type:'postback',label:'期間指定',data:'BULK=PERIOD'}}
  ]));
}

function sendPatternButtons(dateArr, targetId) {
  const sheet = openSS().getSheetByName(SHEETS.PATTERN);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    pushLine(targetId, '⚠️ パターンマスターが未登録です');
    return;
  }
  const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const items = rows.map(r => ({
    type: 'action',
    action: {
      type: 'postback',
      label: r[0] + ' ×' + dateArr.length + '日',
      data: 'BATCH&team=' + encodeURIComponent(r[1]) +
            '&time=' + encodeURIComponent(r[2]) +
            '&dates=' + encodeURIComponent(dateArr.join('|'))
    }
  }));
  pushLine(targetId, qr(items));
}

function qr(items) { return { type: 'text', text: '選択してください', quickReply: { items } }; }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function fmt(d) { return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd'); }
