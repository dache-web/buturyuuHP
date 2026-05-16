/**
 * @file calendar.gs
 * @description 🚚 運用担当：カレンダー連携と予定の抽出
 */

/**
 * 登録の最終処理
 */
function finalizeRegistration(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const state = getStatus(userId);
  const userInfo = getUserPlan(userId); // 会員ランク取得

  writeLog("【登録開始】", "ユーザー: " + userId + " プラン: " + userInfo.plan);

  const calendarId = getCalendarId(ss);
  if (!calendarId) return "【エラー】設定シートのB1セルにカレンダーIDを入力してください！";
  if (!state || !state.date || !state.title) return "【エラー】情報の取得に失敗。最初からやり直してください。";

  // --- 10件制限チェック (Noneプランのみ) ---
  if (userInfo.plan === 'None' && userInfo.regCount >= 10) {
    return "⚠️無料枠（10件）の上限に達しました。\n今後も使い続けるには、サブスクリプションへの登録が必要です。詳細はメニューの「サブスク設定」をご確認ください！";
  }

  try {
    const start = new Date(state.date.replace(/-/g, '/').replace('T', ' '));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const title = state.title;

    let meetUrl = "";
    // Meet発行は Proプラン限定
    if (state.meet === 'yes') {
      if (userInfo.plan !== 'Pro') {
        return "⚠️Google Meetの自動発行はProプラン限定機能です。スタンダード/Proプランへのアップグレードをご検討ください！";
      }
      
      writeLog("【登録】", "Meet発行を試みます...");
      const eventJson = {
        summary: title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
      };
      const created = Calendar.Events.insert(eventJson, calendarId, { conferenceDataVersion: 1 });
      meetUrl = created.hangoutLink;
    } else {
      writeLog("【登録】", "通常イベント登録");
      const calendar = CalendarApp.getCalendarById(calendarId);
      const event = calendar.createEvent(title, start, end);
      event.addPopupReminder(10); // 10分前固定
    }

    // カウントアップ
    incrementUsageCount(userId);
    clearStatus(userId);
    
    return `✅予約完了\n${state.date.replace('T', ' ')} ${title}${meetUrl ? '\n🔗' + meetUrl : ''}`;
  } catch (e) {
    handleCriticalError(e);
    return "【登録失敗】" + e.message;
  }
}

/**
 * 予定一覧の取得
 */
function getSchedule(range, userId) {
  const userInfo = getUserPlan(userId);
  const now = new Date();
  let start, end, label;

  if (range === 'tomorrow') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
    label = "[明日の予定]";
  } else if (range === 'week') {
    // 1週間表示は Proプラン限定
    if (userInfo.plan !== 'Pro') {
      return "⚠️1週間の予定表示はProプラン限定機能です。";
    }
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
    label = "[1週間の予定]";
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    label = "[今日の予定]";
  }

  const ss = SpreadsheetApp.openById(SS_ID);
  const calendarId = getCalendarId(ss);
  try {
    const events = CalendarApp.getCalendarById(calendarId).getEvents(start, end);
    if (events.length === 0) return label + "\n\nなし";
    
    let msg = label + "\n\n";
    events.forEach(e => {
      const time = Utilities.formatDate(e.getStartTime(), 'JST', 'MM/dd HH:mm');
      msg += `【${time}】 ${e.getTitle()}\n────────────────\n`;
    });
    return msg;
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

/**
 * --- LIFF 連携用の登録処理 ---
 */

/**
 * LIFFからの登録データを処理し、カレンダーへ登録する
 */
function processLiffRegistration(payload) {
  const userInfo = getUserPlan(payload.userId);
  
  // 1. 10件制限チェック (Noneプランのみ)
  if (userInfo.plan === 'None' && userInfo.regCount >= 10) {
    return { success: false, error: "⚠️無料枠（10件）の上限に達しました。\n今後も使い続けるには、サブスクリプションへの登録が必要です。" };
  }

  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const calendarId = getCalendarId(ss);
    
    // 日時の解析と「年」の自動判定
    const now = new Date();
    const currentYear = now.getFullYear();

    // 開始日時の構築
    let start = new Date(currentYear, payload.start.month - 1, payload.start.day, payload.start.hour, payload.start.min);
    // もし選択日時が「現在より前（1ヶ月以上前などの極端な過去）」で、かつ「年またぎ」が想定される場合、翌年とする
    // ここでは単純に「今日より前」なら来年とする
    if (start < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0)) {
      start.setFullYear(currentYear + 1);
    }

    // 終了日時の構築
    let end = new Date(start.getFullYear(), payload.end.month - 1, payload.end.day, payload.end.hour, payload.end.min);
    // 終了が開始より前の場合は翌日扱い（日をまたぐ会議など）
    if (end <= start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    let meetUrl = "";
    // Meet発行は Proプラン限定
    if (payload.meetReq) {
      if (userInfo.plan !== 'Pro') {
        return { success: false, error: "⚠️Google Meetの自動発行はProプラン限定機能です。" };
      }
      
      const eventJson = {
        summary: payload.title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
      };
      const created = Calendar.Events.insert(eventJson, calendarId, { conferenceDataVersion: 1 });
      meetUrl = created.hangoutLink;
    } else {
      const calendar = CalendarApp.getCalendarById(calendarId);
      calendar.createEvent(payload.title, start, end);
    }

    // カウントアップ
    incrementUsageCount(payload.userId);
    
    return { success: true, meetUrl: meetUrl };
  } catch (e) {
    handleCriticalError(e);
    return { success: false, error: "【登録失敗】" + e.message };
  }
}
