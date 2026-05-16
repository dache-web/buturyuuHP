/**
 * @file main.gs
 * @description 🚚 運用担当：全体のコントロールとイベント振り分け
 */

function doPost(e) {
  try {
    const contents = e.postData.contents;
    writeLog("【受信】", contents);
    
    const json = JSON.parse(contents);
    if (!json.events || json.events.length === 0) return ContentService.createTextOutput("OK");

    const event = json.events[0];
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    // --- ① ポストバック（ボタン）の処理 ---
    if (event.type === 'postback') {
      const data = event.postback.data;
      writeLog("【ボタン操作】", data);
      
      if (data.startsWith('action=choose_month')) {
        sendDateTimePicker(replyToken, data.split('=')[2]);
        updateStatus(userId, { status: 'WAIT_FOR_DATE' });
      } else if (data === 'action=select_date') {
        handleDateSelection(replyToken, userId, event.postback.params.datetime);
      } else if (data.startsWith('action=set_meet')) {
        updateStatus(userId, { meet: data.split('=')[2] });
        sendReply(replyToken, finalizeRegistration(userId));
      } else if (data.startsWith('action=reg_sub')) {
        handleSubscriptionRegistration(replyToken, userId, data.split('=')[2]);
      }
      return ContentService.createTextOutput("OK");
    }

    // --- ② メッセージ（テキスト）の処理 ---
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      const state = getStatus(userId);

      // 名前入力待ちの処理
      if (state && state.status === 'WAIT_FOR_TITLE') {
        updateStatus(userId, { title: text });
        if (String(state.isDetailed) === 'true') {
          sendMeetChoice(replyToken);
        } else {
          sendReply(replyToken, finalizeRegistration(userId));
        }
        return ContentService.createTextOutput("OK");
      }

      // メニューコマンド
      if (text === '予定登録') {
        sendRegistrationChoices(replyToken);
      } else if (text === 'かんたん予約') {
        updateStatus(userId, { isDetailed: 'false', status: 'SELECT_MONTH' });
        sendMonthSelection(replyToken);
      } else if (text === 'こだわり予約') {
        // こだわり予約は Pro限定チェック
        const userInfo = getUserPlan(userId);
        if (userInfo.plan !== 'Pro') {
          sendReply(replyToken, "⚠️「こだわり予約」はProプラン限定機能です。設定からProプラン初回無料登録をお試しください！");
          return ContentService.createTextOutput("OK");
        }
        updateStatus(userId, { isDetailed: 'true', status: 'SELECT_MONTH' });
        sendMonthSelection(replyToken);
      } else if (text.includes('今日')) {
        sendReply(replyToken, getSchedule('today', userId));
      } else if (text.includes('明日')) {
        sendReply(replyToken, getSchedule('tomorrow', userId));
      } else if (text.includes('1週間')) {
        sendReply(replyToken, getSchedule('week', userId));
      } else if (text === 'サブスク設定') {
        sendSubscriptionMenu(replyToken, userId);
      } else if (text === 'お問い合わせ') {
        sendInquiryMenu(replyToken);
      } else {
        sendReply(replyToken, "「予定登録」や「今日の予定」と送ってください。");
      }
    }
  } catch (err) {
    handleCriticalError(err);
  }
  return ContentService.createTextOutput("OK");
}

/**
 * 日付選択時のバリデーション
 */
function handleDateSelection(replyToken, userId, selDate) {
  const selectedTime = new Date(selDate.replace(/-/g, '/').replace('T', ' '));
  const now = new Date();
  
  if (selectedTime < now) {
    sendReply(replyToken, "⚠️過去の日時は選択できません。\n未来の日時を選んでください。");
    return;
  }

  updateStatus(userId, { date: selDate, status: 'WAIT_FOR_TITLE' });
  sendReply(replyToken, `【日時OK】${selDate.replace('T', ' ')}\n予定名を入力してください。`);
}

/**
 * 登録メニューの統合表示（クイックリプライ等）
 */
function sendRegistrationChoices(replyToken) {
  const liffUrl = "https://liff.line.me/YOUR_LIFF_ID"; // LIFF作成後にIDを差し替えてください
  callLineAPI(replyToken, [{
    'type': 'template',
    'altText': '予約方法の選択',
    'template': {
      'type': 'buttons',
      'title': '予約スケジュール登録',
      'text': 'どちらの方法で予約しますか？',
      'actions': [
        { 'type': 'uri', 'label': 'アプリで予約（推奨）', 'uri': liffUrl },
        { 'type': 'message', 'label': 'チャットで予約（簡易）', 'text': 'かんたん予約' },
        { 'type': 'message', 'label': 'チャットで予約（詳細）', 'text': 'こだわり予約' }
      ]
    }
  }]);
}

/**
 * --- LIFF 連携用 ---
 */

/**
 * GETリクエスト受取（LIFF画面の表示）
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('予約スケジュール登録')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * LIFFからの登録実行関数（フロントエンドから呼び出し）
 * @param {Object} payload { userId, title, date, startTime, endTime, meetReq }
 */
function registerFromLiff(payload) {
  try {
    writeLog("【LIFF連携開始】", JSON.stringify(payload));
    
    // 登録ロジックの実行
    const result = processLiffRegistration(payload);
    
    if (result.success) {
      // ユーザーに完了メッセージを送信（プッシュ通知）
      const msg = `✅予約完了 (アプリ)\n${payload.date} ${payload.startTime}〜${payload.endTime}\n${payload.title}${result.meetUrl ? '\n🔗' + result.meetUrl : ''}`;
      pushMessage(payload.userId, msg);
      return "OK";
    } else {
      return result.error;
    }
  } catch (err) {
    handleCriticalError(err);
    return "【システムエラー】管理者にお問い合わせください。";
  }
}
