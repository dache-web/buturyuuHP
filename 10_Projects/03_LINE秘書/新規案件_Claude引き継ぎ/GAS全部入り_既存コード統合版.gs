/**
 * 【LINE秘書：最終完成版 Ver 3.2】
 * 
 * ・機能: お問い合わせURLをスプレッドシート「設定」シートのB2セルから取得
 * ・安定: プロパティサービスによる高速・正確な予約登録
 * ・管理: ユーザー増減・入力ログの自動記録
 */

// --- システム設定 ---
const LINE_TOKEN = 'YOUR_LINE_TOKEN';
const SS_ID = 'YOUR_SPREADSHEET_ID';

const TEST_MODE = true;
const LOG_MAX_ROWS = 5000;
const LOG_TRIM_COUNT = 500;

function getLineToken_() {
  const propToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  const token = String(propToken || LINE_TOKEN || '').trim();
  if (!token || token === 'YOUR_LINE_TOKEN') {
    throw new Error('LINEチャネルアクセストークンが未設定です。コードのLINE_TOKEN、またはスクリプトプロパティ LINE_CHANNEL_ACCESS_TOKEN を設定してください。');
  }
  return token;
}

function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents);

    // MakeからのAPI呼び出しの場合だけ、LINE Webhookとは別ルートで処理する
    if (isMakeApiPayload_(json)) return handleMakeApiRequest_(json);

    if (!json.events || json.events.length === 0) return ContentService.createTextOutput("OK");
    
    writeLog("【受信】", json);
    const event = json.events[0];
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    writeLog("【イベント概要】", {
      type: event.type,
      sourceType: event.source ? event.source.type : '',
      postbackData: event.postback ? event.postback.data : '',
      postbackParams: event.postback ? event.postback.params : '',
      messageText: event.message && event.message.text ? event.message.text : ''
    });

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
    writeLog("【致命的大エラー】", err.stack || err.message);
  }
  return ContentService.createTextOutput("OK");
}

/**
 * ログ記録（自動ローテーション・エラー分離対応）
 */
function writeLog(tag, msg) {
  try {
    const ss = getSpreadsheet_();
    const logData = [new Date(), tag, typeof msg === 'object' ? JSON.stringify(msg) : msg];
    
    // 1. 通常ログへの記録
    let logSheet = ss.getSheetByName('ログ') || ss.insertSheet('ログ');
    logSheet.appendRow(logData);
    
    // 2. 自動ローテーション（行数制限）
    const lastRow = logSheet.getLastRow();
    if (lastRow > LOG_MAX_ROWS) {
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

function getSpreadsheet_() {
  const id = extractSpreadsheetId_(SS_ID);
  if (!id) throw new Error('SS_IDが未設定です。スプレッドシートIDまたはURLを設定してください。');
  try {
    return SpreadsheetApp.openById(id);
  } catch (err) {
    throw new Error(
      'スプレッドシートを開けません。SS_IDには「GoogleスプレッドシートのURL」または「/d/ と /edit の間のID」を入れてください。' +
      ' 現在読み取ったID: ' + id +
      ' / 元のSS_ID: ' + SS_ID +
      ' / 元エラー: ' + err.message
    );
  }
}

function extractSpreadsheetId_(value) {
  let text = String(value || '').trim();
  if (!text || text === 'YOUR_SPREADSHEET_ID') return '';

  const assignmentMatch = text.match(/SS_ID\s*=\s*['"]([^'"]+)['"]/);
  if (assignmentMatch && assignmentMatch[1]) {
    text = assignmentMatch[1].trim();
  }

  const match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];

  const clean = text
    .replace(/^.*\/d\//, '')
    .replace(/\/edit.*$/, '')
    .replace(/[?#].*$/, '')
    .trim();
  return clean;
}

function test_spreadsheetOpen() {
  const ss = getSpreadsheet_();
  Logger.log('Spreadsheet name: ' + ss.getName());
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
}

function recordUserChange(userId, status) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName('ユーザー推移') || ss.insertSheet('ユーザー推移');
  if (sheet.getLastRow() === 0) sheet.appendRow(['日付', 'ラインID', 'ステータス']);
  sheet.appendRow([Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm'), userId, status]);
}

function dispatchAction(event, userId, replyToken, userInfo, writeLog) {
  if (event.type === 'postback') {
    const data = event.postback.data;
    const params = event.postback.params || {};
    
    if (data.startsWith('action=select_date')) {
      handleDateSelection(replyToken, userId, params.datetime || params.date || params.time, writeLog);
    } 
    else if (data.startsWith('action=adjust_start_date')) {
      handleScheduleAdjustStartDate(replyToken, userId, params.date || params.datetime, writeLog);
    }
    else if (data.startsWith('action=adjust_end_date')) {
      handleScheduleAdjustEndDate(replyToken, userId, params.date || params.datetime, writeLog);
    }
    else if (data.startsWith('action=adjust_duration_picker')) {
      handleScheduleAdjustDuration(replyToken, userId, params.time, writeLog);
    }
    else if (data.startsWith('action=adjust_url_type')) {
      handleScheduleAdjustUrlType(replyToken, userId, data.split('=')[2], writeLog);
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
        sendUrlTypeChoiceFlex(replyToken, confirmText);
      } else {
        sendReply(replyToken, confirmText + "\n\n登録を完了します...");
        sendPushMessage(userId, finalizeRegistration(userId, userInfo, writeLog));
      }
    }
    else if (data.startsWith('action=set_meet')) {
      updateStatus(userId, { meet: data.split('=')[2] }, writeLog);
      sendReply(replyToken, finalizeRegistration(userId, userInfo, writeLog));
    }
    else if (data.startsWith('action=set_url_type')) {
      updateStatus(userId, { urlType: data.split('=')[2] }, writeLog);
      sendReply(replyToken, finalizeRegistration(userId, userInfo, writeLog));
    }
    return;
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    
    const systemCommands = [
      '予約する', '登録', 'かんたん予約', 'URL付登録', 'こだわり予約', 
      '日程調整', '候補を作成', '空き時間を確認', '番号で確定', 
      '設定', '使い方', 'アドレス登録', 'サブスク登録', 
      'Zoom URL登録/確認', 'Zoom URL登録', 'Zoom URL確認', 
      '現在の設定確認', 'お問い合わせ', '中止', 'キャンセル'
    ];
    const isWeekReq = text.includes('1週間') || text.includes('１週間') || text.includes('一週間');
    const isSystemCommand = systemCommands.includes(text) || text.includes('今日') || text.includes('明日') || isWeekReq;

    // メニューからの入力など、システムコマンドが直接打たれた場合は入力状態を強制リセット
    if (isSystemCommand) {
      clearStatus(userId);
      if (text === '中止' || text === 'キャンセル') {
        sendReply(replyToken, "処理を中止しました。（入力状態をリセットしました）");
        return;
      }
      // それ以外のコマンドはリセットした上で下の通常処理へ流す
    } else {
      // システムコマンド以外（URLやメールアドレスなどの単なるテキスト）の場合、入力待ちかチェックする
      const state = getStatus(userId);

      if (state && state.status === 'WAIT_FOR_EMAIL') {
        if (!isValidEmail_(text)) {
          sendReply(replyToken, "メールアドレスの形式を確認してください。\n例: sample@example.com");
          return;
        }
        saveUserEmail_(userId, text, writeLog);
        clearStatus(userId);
        sendReply(replyToken, "アドレスを登録しました。\n" + text);
        return;
      }

      if (state && state.status === 'WAIT_FOR_ZOOM_URL') {
        // Zoomの招待文（文章そのまま）を受け入れるための緩和
        if (text.toLowerCase().indexOf('zoom') === -1 || text.indexOf('http') === -1) {
          sendReply(replyToken, "ZoomのURLが含まれていません。\nZoomからコピーした招待文をそのまま貼り付けてください。");
          return;
        }
        saveUserZoomUrl_(userId, text, writeLog);
        clearStatus(userId);
        sendReply(replyToken, "Zoom情報を登録しました。\n" + text);
        return;
      }

      if (state && state.status === 'WAIT_FOR_TITLE') {
        updateStatus(userId, { title: text }, writeLog);
        sendDurationPicker(replyToken);
        return;
      }

      if (state && state.status === 'WAIT_FOR_ADJUST_TITLE') {
        handleScheduleAdjustTitle(replyToken, userId, text, writeLog);
        return;
      }
    }

    const candidateNumber = extractCandidateNumber_(text);
    if (candidateNumber) {
      handleCandidateNumberReply(replyToken, userId, event, candidateNumber, writeLog);
      return;
    }

    // 管理者コマンド
    if (text === '!システムログ削除' && TEST_MODE) {
      clearLogs();
      sendReply(replyToken, "✅システムログをクリアしました。");
      return;
    }

    const isWeekReqForLower = text.includes('1週間') || text.includes('１週間') || text.includes('一週間');

    if (text === '予約する') {
      sendReservationMenu(replyToken);
    } else if (text === '登録' || text === 'かんたん予約') {
      updateStatus(userId, { isDetailed: 'false', status: 'SELECT_MONTH', meet: 'no' }, writeLog);
      sendMonthSelectionFlex(replyToken);
    } else if (text === 'URL付登録' || text === 'こだわり予約') {
      updateStatus(userId, { isDetailed: 'true', status: 'SELECT_MONTH', meet: 'no', urlType: '' }, writeLog);
      sendMonthSelectionFlex(replyToken);
    } else if (text === '日程調整') {
      sendScheduleAdjustMenu(replyToken);
    } else if (text === '候補を作成') {
      startScheduleAdjustFlow(replyToken, userId, 'proposal', event, writeLog);
    } else if (text === '空き時間を確認') {
      startScheduleAdjustFlow(replyToken, userId, 'availability', event, writeLog);
    } else if (text === '番号で確定') {
      sendCandidateConfirmGuide(replyToken);
    } else if (text.includes('今日')) {
      sendReply(replyToken, getSchedule('today', userInfo));
    } else if (text.includes('明日')) {
      sendReply(replyToken, getSchedule('tomorrow', userInfo));
    } else if (isWeekReqForLower) {
      sendReply(replyToken, getSchedule('week', userInfo));
    } else if (text === '設定') {
      sendSettingsMenu(replyToken);
    } else if (text === '使い方') {
      sendUsageGuide(replyToken);
    } else if (text === 'アドレス登録') {
      updateStatus(userId, { status: 'WAIT_FOR_EMAIL' }, writeLog);
      sendAddressRegistrationGuide(replyToken);
    } else if (text === 'サブスク登録') {
      sendSubscriptionMenu(replyToken);
    } else if (text === 'Zoom URL登録/確認') {
      sendZoomSettingsMenu(replyToken, userId);
    } else if (text === 'Zoom URL登録') {
      updateStatus(userId, { status: 'WAIT_FOR_ZOOM_URL' }, writeLog);
      sendZoomUrlRegistrationGuide(replyToken);
    } else if (text === 'Zoom URL確認') {
      sendZoomUrlStatus(replyToken, userId);
    } else if (text === '現在の設定確認') {
      sendCurrentSettings(replyToken, userId);
    } else if (text === 'お問い合わせ') {
      sendInquiryMenu(replyToken);
    } else {
      // --- 【フェーズ1 追加実装】AI秘書判定ロジック ---
      // スケジュール調整関連のキーワードが含まれているか判定（「お願いします」は除外）
      const aiKeywords = ['日程', '調整', 'リスケ', '都合', '空き', '候補'];
      const isAiTarget = aiKeywords.some(keyword => text.includes(keyword));

      if (isAiTarget) {
        try {
          const history = getConversationHistory_(userId, 5); // 直近5件の履歴を取得
          let aiReply = callOpenAI_(userId, text, history); // AI回答生成
          
          // --- コマンドのパース処理（フェーズ2改修：案A・AI完全依存版） ---
          let extractedCommand = null;
          let extractedNumber = null;
          let extractedTime = null;
          // [COMMAND:CONFIRM, NUMBER:1, TIME:14:00] の形式をパース
          const commandMatch = aiReply.match(/\[COMMAND:([A-Z_]+)(?:,\s*NUMBER:([0-9]+))?(?:,\s*TIME:([0-9]{1,2}:[0-9]{2}))?\]/);
          if (commandMatch) {
            extractedCommand = commandMatch[1]; // 例: 'PROPOSE', 'CONFIRM', 'RESCHEDULE'
            extractedNumber = commandMatch[2] ? parseInt(commandMatch[2], 10) : null;
            extractedTime = commandMatch[3] || null; // 例: '14:00'
            // 返信テキストからコマンド部分を削除して綺麗にする
            aiReply = aiReply.replace(commandMatch[0], '').trim();
            
            writeLog("【AIコマンド検知】", { command: extractedCommand, number: extractedNumber });

            // --- 【フェーズ3】システム関数の呼び出し統合 ---
            if (extractedCommand === 'PROPOSE' || extractedCommand === 'RESCHEDULE') {
              try {
                // 開始日を決定（リスケなら7日後から、そうでなければ今日から）
                const startDate = extractedCommand === 'RESCHEDULE' ? new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000) : new Date();
                const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7日間
                const conversationId = (event.source && event.source.type !== 'user') ? getLineConversationKey_(event.source) : userId;
                const sourceType = event.source ? event.source.type : 'user';
                
                // 既存のスケジュール取得関数を呼び出す（proposalモードでIDを発行し、テキストを取得）
                const result = createScheduleAdjustCandidates_(
                  conversationId, 
                  startDate, 
                  endDate, 
                  60, // デフォルト60分
                  sourceType, 
                  'proposal', 
                  'zoom', 
                  '日程調整', 
                  writeLog
                );
                
                if (result && result.proposalId) {
                  // 次の確定処理のために proposalId をキャッシュ
                  PropertiesService.getUserProperties().setProperty('LATEST_PROPOSAL_ID_' + conversationId, result.proposalId);
                }
                
                if (result && result.text) {
                  aiReply += "\n\n" + result.text;
                } else {
                  aiReply += "\n\n※申し訳ありません、該当期間に空き枠が見つかりませんでした。";
                }
              } catch (sysErr) {
                writeLog("【候補取得システムエラー】", sysErr.message);
                aiReply += "\n\n※システムエラーにより空き枠を取得できませんでした。";
              }
            } else if (extractedCommand === 'CONFIRM') {
              try {
                const conversationId = (event.source && event.source.type !== 'user') ? getLineConversationKey_(event.source) : userId;
                const cachedProposalId = PropertiesService.getUserProperties().getProperty('LATEST_PROPOSAL_ID_' + conversationId);
                
                if (!cachedProposalId) {
                  aiReply += "\n\n※直前の提案が見つかりません。お手数ですが再度「日程調整」とご入力ください。";
                } else if (!extractedNumber) {
                  aiReply += "\n\n※確定する番号が認識できませんでした。";
                } else {
                  const sourceType = event.source ? event.source.type : 'user';
                  const confirmPayload = {
                    proposalId: cachedProposalId,
                    candidateNumber: extractedNumber,
                    candidateTime: extractedTime,
                    sourceType: sourceType,
                    userId: userId
                  };
                  // 既存の予定確定・Zoom発行関数を呼び出す
                  const confirmResult = createConfirmedScheduleForMake_(confirmPayload);
                  aiReply += "\n\n" + confirmResult.text;
                }
              } catch (sysErr) {
                writeLog("【予定確定システムエラー】", sysErr.message);
                aiReply += "\n\n※予定の確定中にエラーが発生しました。(" + sysErr.message + ")";
              }
            }
          }

          // AIの回答を「会話ログ」シートに記録
          const ss = getSpreadsheet_();
          const logSheet = ss.getSheetByName('会話ログ');
          if (logSheet) {
            logSheet.appendRow([new Date(), userId, 'assistant', aiReply]);
          }
          
          // LINEへ返信
          sendReply(replyToken, aiReply);
        } catch (e) {
          writeLog("【AI返信エラー】", e.message);
        }
      } else if (event.source && event.source.type === 'user') {
        // キーワードがない、かつ1対1のトークの場合は既存の案内を返す
        sendReply(replyToken, "「今日の予定」「予約する」「日程調整」「設定」などをお送りください。");
      }
      // グループトークでキーワードがない場合は無視する（他の人の会話を邪魔しない）
    }
  }
}

function getSchedule(range, userInfo) {
  const ss = getSpreadsheet_();
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
    const events = getCalendarSafe(ss).getEvents(start, end);
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
  try {
    if (!selDate) throw new Error('LINEから日時データを取得できませんでした。');

    const ss = getSpreadsheet_();
    const calendar = getCalendarSafe(ss);
    const selectedTime = parseLineDateTime(selDate);
    const end = new Date(selectedTime.getTime() + 60 * 60 * 1000);
    const events = calendar.getEvents(selectedTime, end);

    updateStatus(userId, { date: selDate }, writeLog);
    writeLog("【日時選択】", {
      userId: userId,
      selected: selDate,
      parsed: selectedTime,
      duplicateCount: events.length
    });

    if (events.length > 0) {
      const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
        { "type": "text", "text": "予定が重複しております。登録しますか？", "wrap": true, "weight": "bold" },
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
  } catch (err) {
    writeLog("【日時選択エラー】", err.stack || err.message);
    sendReply(replyToken, "日時の取得でエラーが発生しました。もう一度「かんたん予約」から試してください。");
  }
}

function finalizeRegistration(userId, userInfo, writeLog) {
  const state = getStatus(userId);
  const ss = getSpreadsheet_();
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
       getCalendarSafe(ss).createAllDayEvent(title, start);
    } else {
       const end = new Date(start.getTime() + totalMins * 60000);
       if ((state.meet === 'yes' || state.urlType === 'meet') && typeof Calendar !== 'undefined') {
         try {
           const calendarId = getCalendarId(ss) || CalendarApp.getDefaultCalendar().getId();
           const eventJson = { summary: title, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } };
           meetUrl = Calendar.Events.insert(eventJson, calendarId, { conferenceDataVersion: 1 }).hangoutLink;
         } catch (e) { writeLog("【Meetエラー】", e.message); }
       }
       if (state.urlType === 'zoom') {
         meetUrl = getZoomUrlForUser_(userId);
         getCalendarSafe(ss).createEvent(title, start, end, { description: 'Zoom: ' + meetUrl });
       } else if (!meetUrl) {
         getCalendarSafe(ss).createEvent(title, start, end);
       }
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
    if (val) return val.trim(); 
  }
  return ""; 
}

function getCalendarSafe(ss) {
  const calendarId = getCalendarId(ss);
  if (calendarId) {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (calendar) return calendar;
    writeLog("【カレンダー警告】", "設定シートB1のカレンダーIDが見つからないため、デフォルトカレンダーを使います: " + calendarId);
  }
  return CalendarApp.getDefaultCalendar();
}

function parseLineDateTime(value) {
  const normalized = String(value).replace(/-/g, '/').replace('T', ' ');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) throw new Error('日時形式が正しくありません: ' + value);
  return date;
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
  const ss = getSpreadsheet_();
  const url = getInquiryUrl(ss);
  callLineAPI(replyToken, [{ 'type': 'template', 'altText': 'お問合せ', 'template': { 'type': 'buttons', 'text': 'ご連絡をお待ちしております', 'actions': [{ 'type': 'uri', 'label': 'フォームを開く', 'uri': url }] } }]);
}

function sendReservationMenu(replyToken) {
  const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
    { "type": "text", "text": "予約する", "weight": "bold", "size": "md" },
    { "type": "text", "text": "登録方法を選んでください。", "size": "sm", "color": "#666666", "margin": "sm" },
    { "type": "box", "layout": "vertical", "spacing": "sm", "margin": "md", "contents": [
      { "type": "button", "height": "sm", "style": "primary", "action": { "type": "message", "label": "登録", "text": "登録" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "message", "label": "URL付登録", "text": "URL付登録" } }
    ]}
  ]}};
  callLineAPI(replyToken, [{ "type": "flex", "altText": "予約メニュー", "contents": flex }]);
}

function sendScheduleAdjustMenu(replyToken) {
  const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
    { "type": "text", "text": "日程調整", "weight": "bold", "size": "md" },
    { "type": "text", "text": "秘書が期間内の空き候補を番号付きで作成します。", "size": "sm", "color": "#666666", "wrap": true, "margin": "sm" },
    { "type": "box", "layout": "vertical", "spacing": "sm", "margin": "md", "contents": [
      { "type": "button", "height": "sm", "style": "primary", "action": { "type": "message", "label": "候補を作成", "text": "候補を作成" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "message", "label": "空き時間を確認", "text": "空き時間を確認" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "message", "label": "番号で確定", "text": "番号で確定" } }
    ]}
  ]}};
  callLineAPI(replyToken, [{ "type": "flex", "altText": "日程調整メニュー", "contents": flex }]);
}

function startScheduleAdjustFlow(replyToken, userId, mode, event, writeLog) {
  const sourceType = event.source && event.source.type === 'user' ? 'user' : 'group';
  const conversationId = getLineConversationKey_(event.source);
  updateStatus(userId, {
    status: 'WAIT_FOR_ADJUST_START_DATE',
    adjustMode: mode,
    sourceType: sourceType,
    adjustConversationId: conversationId
  }, writeLog);
  sendScheduleAdjustStartDatePicker(replyToken);
}

function sendScheduleAdjustStartDatePicker(replyToken) {
  const today = startOfDay_(new Date());
  const minDate = formatDate_(today, 'yyyy-MM-dd');
  callLineAPI(replyToken, [{
    "type": "text",
    "text": "候補を探す開始日を選択してください。",
    "quickReply": { "items": [{ "type": "action", "action": { "type": "datetimepicker", "label": "開始日を選択", "data": "action=adjust_start_date", "mode": "date", "initial": minDate, "min": minDate } }]}
  }]);
}

function handleScheduleAdjustStartDate(replyToken, userId, selectedDate, writeLog) {
  try {
    if (!selectedDate) throw new Error('開始日を取得できませんでした。');
    const startDate = parseDateOnly_(selectedDate);
    updateStatus(userId, {
      status: 'WAIT_FOR_ADJUST_END_DATE',
      adjustStartDate: formatDate_(startDate, 'yyyy/MM/dd')
    }, writeLog);
    sendScheduleAdjustEndDatePicker(replyToken, startDate);
  } catch (err) {
    writeLog("【日程調整開始日エラー】", err.stack || err.message);
    sendReply(replyToken, "開始日の取得でエラーが発生しました。もう一度「日程調整」から試してください。");
  }
}

function sendScheduleAdjustEndDatePicker(replyToken, startDate) {
  const minDate = formatDate_(startDate, 'yyyy-MM-dd');
  const initial = formatDate_(addDays_(startDate, 7), 'yyyy-MM-dd');
  callLineAPI(replyToken, [{
    "type": "text",
    "text": "候補を探す終了日を選択してください。",
    "quickReply": { "items": [{ "type": "action", "action": { "type": "datetimepicker", "label": "終了日を選択", "data": "action=adjust_end_date", "mode": "date", "initial": initial, "min": minDate } }]}
  }]);
}

function handleScheduleAdjustEndDate(replyToken, userId, selectedDate, writeLog) {
  try {
    if (!selectedDate) throw new Error('終了日を取得できませんでした。');
    const state = getStatus(userId);
    const startDate = parseDateOnly_(state.adjustStartDate);
    const endDate = parseDateOnly_(selectedDate);
    if (endDate.getTime() < startDate.getTime()) throw new Error('終了日は開始日以降にしてください。');

    updateStatus(userId, {
      status: 'WAIT_FOR_ADJUST_DURATION',
      adjustEndDate: formatDate_(endDate, 'yyyy/MM/dd')
    }, writeLog);
    sendScheduleAdjustDurationPicker(replyToken);
  } catch (err) {
    writeLog("【日程調整終了日エラー】", err.stack || err.message);
    sendReply(replyToken, "終了日の取得でエラーが発生しました。もう一度「日程調整」から試してください。");
  }
}

function sendScheduleAdjustDurationPicker(replyToken) {
  const defaults = getSecretarySettings_();
  const initial = minutesToTimeText_(defaults.defaultDurationMinutes || 60);
  callLineAPI(replyToken, [{
    "type": "text",
    "text": "打ち合わせの長さを選択してください。",
    "quickReply": { "items": [{ "type": "action", "action": { "type": "datetimepicker", "label": "時間を設定", "data": "action=adjust_duration_picker", "mode": "time", "initial": initial } }]}
  }]);
}

function handleScheduleAdjustDuration(replyToken, userId, timeStr, writeLog) {
  try {
    if (!timeStr) throw new Error('打ち合わせの長さを取得できませんでした。');
    const state = getStatus(userId);
    const slotMinutes = timeTextToMinutes_(timeStr);
    if (slotMinutes <= 0) throw new Error('打ち合わせの長さは1分以上にしてください。');

    // 「空き時間を確認(availability)」でも「候補を作成(proposal)」でも、
    // 長さを選んだ直後にスケジュール候補を作成して返す仕様に変更。
    // ※件名は「日程調整」、URL種別は「zoom」をデフォルトとする。
    updateStatus(userId, {
      status: 'ADJUST_CANDIDATES_CREATED',
      adjustDuration: timeStr,
      adjustTitle: '日程調整',
      adjustUrlType: 'zoom'
    }, writeLog);

    const startDate = parseDateOnly_(state.adjustStartDate);
    const endDate = parseDateOnly_(state.adjustEndDate);
    const conversationId = state.adjustConversationId || userId;
    const mode = state.adjustMode || 'proposal';
    
    const result = createScheduleAdjustCandidates_(conversationId, startDate, endDate, slotMinutes, state.sourceType || 'user', mode, 'zoom', '日程調整', writeLog);
    sendLongTextReply_(replyToken, result.text);
    return;

  } catch (err) {
    writeLog("【日程調整時間エラー】", err.stack || err.message);
    sendReply(replyToken, "時間の取得でエラーが発生しました。\n" + err.message);
  }
}

function sendScheduleAdjustUrlTypePicker(replyToken) {
  const settings = getSecretarySettings_();
  const buttons = [
    { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "postback", "label": "Google Meet", "data": "action=adjust_url_type=meet" } }
  ];
  if (settings.zoomEnabled) {
    buttons.unshift({ "type": "button", "height": "sm", "style": "primary", "action": { "type": "postback", "label": "Zoom", "data": "action=adjust_url_type=zoom" } });
  }
  const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
    { "type": "text", "text": "URL種別", "weight": "bold", "size": "md" },
    { "type": "text", "text": "確定時に発行・添付するURLを選んでください。", "size": "sm", "color": "#666666", "wrap": true, "margin": "sm" },
    { "type": "box", "layout": "vertical", "spacing": "sm", "margin": "md", "contents": buttons }
  ]}};
  callLineAPI(replyToken, [{ "type": "flex", "altText": "URL種別選択", "contents": flex }]);
}

function handleScheduleAdjustUrlType(replyToken, userId, urlType, writeLog) {
  try {
    updateStatus(userId, {
      status: 'WAIT_FOR_ADJUST_TITLE',
      adjustUrlType: urlType
    }, writeLog);

    sendScheduleAdjustTitleGuide(replyToken);
  } catch (err) {
    writeLog("【日程調整候補作成エラー】", err.stack || err.message);
    sendReply(replyToken, "候補作成でエラーが発生しました。\n" + err.message);
  }
}

function sendScheduleAdjustTitleGuide(replyToken) {
  sendReply(replyToken, "予定の件名を入力してください。\n\n例: 打ち合わせ\n例: 初回相談\n例: 定例ミーティング");
}

function handleScheduleAdjustTitle(replyToken, userId, title, writeLog) {
  try {
    const state = getStatus(userId);
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) throw new Error('件名を入力してください。');

    const slotMinutes = timeTextToMinutes_(state.adjustDuration);
    const startDate = parseDateOnly_(state.adjustStartDate);
    const endDate = parseDateOnly_(state.adjustEndDate);
    const sourceType = state.sourceType || 'user';
    const conversationId = state.adjustConversationId || userId;
    const urlType = state.adjustUrlType || 'zoom';

    updateStatus(userId, {
      status: 'ADJUST_CANDIDATES_CREATED',
      adjustTitle: cleanTitle
    }, writeLog);

    const result = createScheduleAdjustCandidates_(conversationId, startDate, endDate, slotMinutes, sourceType, 'proposal', urlType, cleanTitle, writeLog);
    sendLongTextReply_(replyToken, result.text);
  } catch (err) {
    writeLog("【日程調整件名エラー】", err.stack || err.message);
    sendReply(replyToken, "件名の登録でエラーが発生しました。\n" + err.message);
  }
}

function sendSettingsMenu(replyToken) {
  const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
    { "type": "text", "text": "設定メニュー", "weight": "bold", "size": "md" },
    { "type": "text", "text": "必要な項目を選んでください。", "size": "sm", "color": "#666666", "margin": "sm" },
    { "type": "box", "layout": "vertical", "spacing": "sm", "margin": "md", "contents": [
      { "type": "button", "height": "sm", "style": "primary", "action": { "type": "message", "label": "使い方", "text": "使い方" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "message", "label": "アドレス登録", "text": "アドレス登録" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "message", "label": "サブスク登録", "text": "サブスク登録" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "message", "label": "Zoom URL", "text": "Zoom URL登録/確認" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "message", "label": "お問い合わせ", "text": "お問い合わせ" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "message", "label": "設定確認", "text": "現在の設定確認" } }
    ]}
  ]}};
  callLineAPI(replyToken, [{ "type": "flex", "altText": "設定メニュー", "contents": flex }]);
}

function sendUsageGuide(replyToken) {
  const msg = [
    "使い方",
    "",
    "【予定確認】",
    "今日の予定 / 明日の予定 / 1週間の予定",
    "",
    "【登録】",
    "予約するから、通常登録またはURL付登録を選びます。",
    "",
    "【日程調整】",
    "期間と打ち合わせ時間から候補を作成し、番号付きで相手に送れる文面を作ります。",
    "",
    "【設定】",
    "アドレス登録、サブスク登録、Zoom URL確認、お問い合わせを行います。"
  ].join('\n');
  sendReply(replyToken, msg);
}

function sendAddressRegistrationGuide(replyToken) {
  sendReply(replyToken, "通知や確認に使うメールアドレスを登録します。\n登録したいメールアドレスを送ってください。\n\n例: sample@example.com");
}

function sendSubscriptionMenu(replyToken) {
  const ss = getSpreadsheet_();
  const url = getSettingValue_(ss, 'B5');
  const message = getSettingValue_(ss, 'B6') || 'サブスク登録はこちらからお願いします。';

  if (!url || !String(url).startsWith('http')) {
    sendReply(replyToken, "サブスク登録URLが未設定です。\n設定シートB5に登録URLを入力してください。");
    return;
  }

  callLineAPI(replyToken, [{ 'type': 'template', 'altText': 'サブスク登録', 'template': { 'type': 'buttons', 'text': message, 'actions': [{ 'type': 'uri', 'label': '登録ページを開く', 'uri': url }] } }]);
}

function sendZoomSettingsMenu(replyToken, userId) {
  const userSettings = getUserSettings_(userId);
  const zoomText = userSettings.zoomUrl ? '現在のZoom URLが登録されています。' : 'Zoom URLはまだ登録されていません。';
  const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
    { "type": "text", "text": "Zoom URL", "weight": "bold", "size": "md" },
    { "type": "text", "text": zoomText, "size": "sm", "color": "#666666", "wrap": true, "margin": "sm" },
    { "type": "box", "layout": "vertical", "spacing": "sm", "margin": "md", "contents": [
      { "type": "button", "height": "sm", "style": "primary", "action": { "type": "message", "label": "登録/変更", "text": "Zoom URL登録" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "message", "label": "確認", "text": "Zoom URL確認" } }
    ]}
  ]}};
  callLineAPI(replyToken, [{ "type": "flex", "altText": "Zoom URL設定", "contents": flex }]);
}

function sendZoomUrlRegistrationGuide(replyToken) {
  sendReply(replyToken, "使用するZoom URLを登録します。\n固定のZoomミーティングURLを送ってください。\n\n例: https://zoom.us/j/xxxxxxxxxx");
}

function sendZoomUrlStatus(replyToken, userId) {
  const userSettings = getUserSettings_(userId);
  if (!userSettings.zoomUrl) {
    sendReply(replyToken, "Zoom URLはまだ登録されていません。\n「Zoom URL登録」から登録してください。");
    return;
  }
  sendReply(replyToken, "登録中のZoom URLはこちらです。\n" + userSettings.zoomUrl);
}

function getZoomUrlForUser_(userId) {
  const userSettings = getUserSettings_(userId);
  if (userSettings.zoomUrl) return userSettings.zoomUrl;

  const ss = getSpreadsheet_();
  const representativeZoomUrl = getSettingValue_(ss, 'B3');
  if (representativeZoomUrl && isValidUrl_(representativeZoomUrl)) return representativeZoomUrl;

  try {
    const rotated = getRotatingZoomUrlForMake_();
    if (rotated && rotated.zoomUrl) return rotated.zoomUrl;
  } catch (err) {
    writeLog("【Zoom URL取得エラー】", err.message);
  }

  throw new Error('Zoom URLが未登録です。「設定」→「Zoom URL」から登録してください。');
}

function sendCurrentSettings(replyToken, userId) {
  const ss = getSpreadsheet_();
  const userSettings = getUserSettings_(userId);
  const calendarId = getSettingValue_(ss, 'B1');
  const inquiryUrl = getSettingValue_(ss, 'B2');
  const representativeZoomUrl = getSettingValue_(ss, 'B3');
  const adminEmail = getSettingValue_(ss, 'B4');
  const subscriptionUrl = getSettingValue_(ss, 'B5');
  const subscriptionMessage = getSettingValue_(ss, 'B6');
  const defaultDurationMinutes = getSettingValue_(ss, 'B7');
  const bufferMinutes = getSettingValue_(ss, 'B8');
  const maxCandidates = getSettingValue_(ss, 'B9');
  const zoomEnabled = getSettingValue_(ss, 'B10');

  const lines = [
    "現在の設定",
    "",
    "カレンダーID: " + formatSetStatus_(calendarId),
    "お問い合わせURL: " + formatSetStatus_(inquiryUrl),
    "代表Zoom URL: " + formatSetStatus_(representativeZoomUrl),
    "管理者メール: " + formatSetStatus_(adminEmail),
    "サブスク登録URL: " + formatSetStatus_(subscriptionUrl),
    "サブスク案内文: " + formatSetStatus_(subscriptionMessage),
    "既定時間: " + (defaultDurationMinutes || "60") + "分",
    "バッファ: " + (bufferMinutes || "0") + "分",
    "候補最大数: " + (maxCandidates || "制限なし"),
    "Zoom利用: " + (zoomEnabled || "TRUE"),
    "メールアドレス: " + (userSettings.email || "未登録"),
    "Zoom URL: " + (userSettings.zoomUrl ? "登録済み" : "未登録"),
    "サブスク状態: " + (userSettings.subscriptionStatus || "未登録")
  ];

  sendReply(replyToken, lines.join('\n'));
}

function saveUserEmail_(userId, email, writeLog) {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateUserSettingsSheet_(ss);
  const now = new Date();
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const userIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < userIds.length; i++) {
      if (String(userIds[i][0]) === String(userId)) {
        const rowNumber = i + 2;
        sheet.getRange(rowNumber, 2).setValue(email);
        sheet.getRange(rowNumber, 5).setValue(now);
        if (writeLog) writeLog("【アドレス更新】", { userId: userId, email: email });
        return;
      }
    }
  }

  sheet.appendRow([userId, email, '', '', now]);
  if (writeLog) writeLog("【アドレス登録】", { userId: userId, email: email });
}

function saveUserZoomUrl_(userId, zoomUrl, writeLog) {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateUserSettingsSheet_(ss);
  const now = new Date();
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const userIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < userIds.length; i++) {
      if (String(userIds[i][0]) === String(userId)) {
        const rowNumber = i + 2;
        sheet.getRange(rowNumber, 3).setValue(zoomUrl);
        sheet.getRange(rowNumber, 5).setValue(now);
        if (writeLog) writeLog("【Zoom URL更新】", { userId: userId, zoomUrl: zoomUrl });
        return;
      }
    }
  }

  sheet.appendRow([userId, '', zoomUrl, '', now]);
  if (writeLog) writeLog("【Zoom URL登録】", { userId: userId, zoomUrl: zoomUrl });
}

function getUserSettings_(userId) {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateUserSettingsSheet_(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { email: '', zoomUrl: '', subscriptionStatus: '' };

  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      return {
        email: String(rows[i][1] || '').trim(),
        zoomUrl: String(rows[i][2] || '').trim(),
        subscriptionStatus: String(rows[i][3] || '').trim()
      };
    }
  }
  return { email: '', zoomUrl: '', subscriptionStatus: '' };
}

function getOrCreateUserSettingsSheet_(ss) {
  const sheet = ss.getSheetByName('ユーザー設定') || ss.insertSheet('ユーザー設定');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['userId', 'メールアドレス', 'Zoom URL', 'サブスク状態', '更新日時']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function isValidEmail_(value) {
  const text = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function isValidUrl_(value) {
  const text = String(value || '').trim();
  return /^https?:\/\/\S+$/i.test(text);
}

function getSettingValue_(ss, cellA1) {
  const sheet = ss.getSheetByName('設定');
  if (!sheet) return '';
  return String(sheet.getRange(cellA1).getValue() || '').trim();
}

function formatSetStatus_(value) {
  return String(value || '').trim() ? "設定済み" : "未設定";
}

function getSecretarySettings_() {
  const ss = getSpreadsheet_();
  return {
    defaultDurationMinutes: toNumber_(getSettingValue_(ss, 'B7'), 60),
    bufferMinutes: toNumber_(getSettingValue_(ss, 'B8'), 0),
    maxCandidates: toNumber_(getSettingValue_(ss, 'B9'), 0),
    zoomEnabled: normalizeBooleanWithDefault_(getSettingValue_(ss, 'B10'), true)
  };
}

function normalizeBooleanWithDefault_(value, defaultValue) {
  const text = String(value || '').trim();
  if (!text) return defaultValue;
  return normalizeBoolean_(text);
}

function getUserPlan(userId) { return { plan: TEST_MODE ? 'Pro' : 'None', regCount: 0 }; }
function callLineAPI(replyToken, messages) {
  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + getLineToken_() },
      'method': 'post',
      'payload': JSON.stringify({ 'replyToken': replyToken, 'messages': messages }),
      'muteHttpExceptions': true
    });
    const code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      writeLog("【LINE返信エラー】", {
        status: code,
        body: res.getContentText(),
        messages: messages
      });
    }
  } catch (err) {
    writeLog("【LINE返信エラー】", err.stack || err.message);
  }
}
function sendReply(replyToken, msg) { callLineAPI(replyToken, [{ 'type': 'text', 'text': msg }]); }
function sendPushMessage(userId, msg) {
  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + getLineToken_() },
      'method': 'post',
      'payload': JSON.stringify({ 'to': userId, 'messages': [{'type': 'text', 'text': msg}] }),
      'muteHttpExceptions': true
    });
    const code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      writeLog("【LINEプッシュエラー】", {
        status: code,
        body: res.getContentText(),
        userId: userId
      });
    }
  } catch (err) {
    writeLog("【LINEプッシュエラー】", err.stack || err.message);
  }
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

function sendUrlTypeChoiceFlex(replyToken, confirmText) {
  const flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "contents": [
    { "type": "text", "text": confirmText, "size": "sm", "color": "#1db446", "weight": "bold" },
    { "type": "text", "text": "発行するURLを選んでください。", "weight": "bold", "margin": "md", "wrap": true },
    { "type": "box", "layout": "vertical", "spacing": "sm", "margin": "md", "contents": [
      { "type": "button", "height": "sm", "style": "primary", "action": { "type": "postback", "label": "Google Meet", "data": "action=set_url_type=meet" } },
      { "type": "button", "height": "sm", "style": "secondary", "action": { "type": "postback", "label": "Zoom", "data": "action=set_url_type=zoom" } }
    ]}
  ]}};
  callLineAPI(replyToken, [{ "type": "flex", "altText": "URL種別選択", "contents": flex }]);
}

function handleCandidateNumberReply(replyToken, userId, event, candidateNumber, writeLog) {
  try {
    const conversationId = getLineConversationKey_(event.source);
    const proposal = findLatestOpenProposalForLine_(conversationId, userId);
    const index = candidateNumber - 1;

    if (index < 0 || index >= proposal.slots.length) {
      sendReply(replyToken, "候補番号が見つかりませんでした。\n候補一覧にある番号でお知らせください。");
      return;
    }

    const selected = proposal.slots[index];
    const start = parseDateTime_(selected.start);
    const end = parseDateTime_(selected.end);
    const ss = getSpreadsheet_();
    const calendar = getCalendarSafe(ss);
    const duplicateEvents = calendar.getEvents(start, end);

    if (duplicateEvents.length > 0) {
      const remainingSlots = filterCurrentlyAvailableSlots_(calendar, proposal.slots, index);
      sendReply(replyToken, buildCandidateDuplicateText_(candidateNumber, remainingSlots));
      return;
    }

    const title = proposal.title || '日程調整';
    const urlType = proposal.urlType || 'zoom';
    const meetingUrl = createMeetingUrlForConfirmedSchedule_(calendar, title, start, end, userId, urlType);
    const eventObj = meetingUrl.event || calendar.createEvent(title, start, end, {
      description: meetingUrl.label + ': ' + meetingUrl.url + '\n提案ID: ' + proposal.proposalId
    });

    markProposalConfirmedForMake_({
      proposalId: proposal.proposalId,
      userId: conversationId,
      title: title
    }, getCreatedEventId_(eventObj), meetingUrl.url, start);

    if (writeLog) {
      writeLog("【日程調整番号確定】", {
        proposalId: proposal.proposalId,
        candidateNumber: candidateNumber,
        start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
        end: formatDate_(end, 'yyyy/MM/dd HH:mm')
      });
    }

    sendReply(replyToken, buildCandidateConfirmedText_(title, start, end, meetingUrl.label, meetingUrl.url));
  } catch (err) {
    writeLog("【日程調整番号確定エラー】", err.stack || err.message);
    sendReply(replyToken, "候補番号を確認できませんでした。\n先に「日程調整」から候補を作成してください。");
  }
}

function findLatestOpenProposalForLine_(conversationId, fallbackUserId) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('提案管理');
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error('提案管理シートに候補がありません。');
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    const rowUserId = String(rows[i][1] || '');
    const status = String(rows[i][4] || '');
    if (status === '確定') continue;
    if (rowUserId !== String(conversationId) && rowUserId !== String(fallbackUserId)) continue;

    const raw = String(rows[i][3] || '');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      continue;
    }

    if (!parsed.slots || parsed.slots.length === 0) continue;
    return {
      rowNumber: i + 2,
      proposalId: rows[i][0],
      userId: rowUserId,
      title: rows[i][2] || parsed.title || '日程調整',
      slots: parsed.slots,
      durationMinutes: parsed.durationMinutes || 60,
      sourceType: parsed.sourceType || '',
      urlType: parsed.urlType || 'zoom',
      status: status
    };
  }

  throw new Error('未確定の提案が見つかりません。');
}

function filterCurrentlyAvailableSlots_(calendar, slots, selectedIndex) {
  const available = [];
  slots.forEach(function(slot, index) {
    if (index === selectedIndex) return;
    const start = parseDateTime_(slot.start);
    const end = parseDateTime_(slot.end);
    if (calendar.getEvents(start, end).length === 0) {
      available.push({
        number: index + 1,
        label: slot.label
      });
    }
  });
  return available;
}

function buildCandidateDuplicateText_(candidateNumber, remainingSlots) {
  const lines = [
    "申し訳ありません。",
    candidateNumber + "番の候補は、先ほど予定が入ってしまいました。",
    ""
  ];

  if (!remainingSlots || remainingSlots.length === 0) {
    lines.push("現在ほかに空いている候補がありません。");
    lines.push("もう一度「日程調整」から候補を作成してください。");
    return lines.join('\n');
  }

  lines.push("現在空いている候補はこちらです。");
  remainingSlots.forEach(function(slot) {
    lines.push(slot.number + ". " + slot.label);
  });
  lines.push("");
  lines.push("別の番号をお知らせください。");
  return lines.join('\n');
}

function buildCandidateConfirmedText_(title, start, end, urlLabel, url) {
  return [
    "日程を確定しました。",
    "件名: " + title,
    "日時: " + formatDate_(start, 'yyyy/MM/dd HH:mm') + ' - ' + formatDate_(end, 'HH:mm'),
    urlLabel + ": " + url
  ].join('\n');
}

function createMeetingUrlForConfirmedSchedule_(calendar, title, start, end, userId, urlType) {
  if (urlType === 'meet') {
    const meetEvent = createGoogleMeetEvent_(title, start, end);
    if (meetEvent && meetEvent.hangoutLink) {
      return {
        label: 'Google Meet',
        url: meetEvent.hangoutLink,
        event: meetEvent
      };
    }
  }

  const zoomUrl = getZoomUrlForUser_(userId);
  return {
    label: 'Zoom',
    url: zoomUrl,
    event: null
  };
}

function createGoogleMeetEvent_(title, start, end) {
  if (typeof Calendar === 'undefined') {
    throw new Error('Google Meet発行には高度なGoogleサービス「Calendar API」を有効にしてください。');
  }

  const ss = getSpreadsheet_();
  const calendarId = getCalendarId(ss) || CalendarApp.getDefaultCalendar().getId();
  const eventJson = {
    summary: title,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    conferenceData: {
      createRequest: {
        requestId: Utilities.getUuid(),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };
  return Calendar.Events.insert(eventJson, calendarId, { conferenceDataVersion: 1 });
}

function getCreatedEventId_(eventObj) {
  if (!eventObj) return '';
  if (typeof eventObj.getId === 'function') return eventObj.getId();
  return eventObj.id || eventObj.iCalUID || '';
}

function extractCandidateNumber_(text) {
  const normalized = String(text || '').replace(/[０-９]/g, function(ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  const numberOnly = normalized.match(/^\s*(\d{1,3})\s*$/);
  if (numberOnly) return Number(numberOnly[1]);

  const withSuffix = normalized.match(/^\s*(\d{1,3})\s*(番|ばん)/);
  if (withSuffix) return Number(withSuffix[1]);

  return null;
}

function getLineConversationKey_(source) {
  if (!source) return '';
  if (source.groupId) return source.groupId;
  if (source.roomId) return source.roomId;
  return source.userId || '';
}

function createScheduleAdjustCandidates_(userId, startDate, endDate, slotMinutes, sourceType, mode, urlType, title, writeLog) {
  const ss = getSpreadsheet_();
  const calendar = getCalendarSafe(ss);
  const businessRules = readBusinessRules_(ss);
  const exceptionRules = readExceptionRules_(ss);
  const settings = getSecretarySettings_();
  const slots = [];

  for (let cursor = startOfDay_(startDate); cursor.getTime() <= endDate.getTime(); cursor = addDays_(cursor, 1)) {
    const openWindows = getOpenWindowsForDate_(cursor, businessRules, exceptionRules);
    if (openWindows.length === 0) continue;

    const events = calendar.getEvents(startOfDay_(cursor), endOfDay_(cursor));
    const busyRanges = eventsToBusyRanges_(events, settings.bufferMinutes || 0);
    const exceptionBlocks = getExceptionBlocksForDate_(cursor, exceptionRules);
    const blockedRanges = busyRanges.concat(exceptionBlocks);

    openWindows.forEach(function(window) {
      const availableBlocks = getAvailableContinuousBlocks_(window.start, window.end, blockedRanges, slotMinutes);
      availableBlocks.forEach(function(block) {
        if (block.start.getTime() < new Date().getTime()) return;
        slots.push(formatSlotForMake_(block.start, block.end));
      });
    });
  }

  const visibleSlots = settings.maxCandidates > 0 ? slots.slice(0, settings.maxCandidates) : slots;
  const omittedCount = Math.max(0, slots.length - visibleSlots.length);

  const proposalId = mode === 'proposal'
    ? saveCandidateProposalForMake_({
      userId: userId,
      sourceType: sourceType,
      title: title || '日程調整',
      urlType: urlType
    }, visibleSlots, slotMinutes)
    : '';

  const text = mode === 'availability'
    ? buildAvailabilityCheckText_(startDate, endDate, slotMinutes, visibleSlots, omittedCount)
    : buildScheduleProposalText_(startDate, endDate, slotMinutes, visibleSlots, sourceType, proposalId, urlType, title || '日程調整', omittedCount);

  if (writeLog) {
    writeLog("【日程調整候補作成】", {
      userId: userId,
      mode: mode,
      sourceType: sourceType,
      startDate: formatDate_(startDate, 'yyyy/MM/dd'),
      endDate: formatDate_(endDate, 'yyyy/MM/dd'),
      slotMinutes: slotMinutes,
      urlType: urlType,
      count: visibleSlots.length,
      totalCount: slots.length,
      proposalId: proposalId
    });
  }

  return { slots: visibleSlots, proposalId: proposalId, text: text };
}

function buildScheduleProposalText_(startDate, endDate, slotMinutes, slots, sourceType, proposalId, urlType, title, omittedCount) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  lines.push('日程候補をご案内いたします。');
  lines.push('ご都合のよい【番号】と【開始希望時刻】をお知らせください。');
  lines.push('');
  lines.push('件名: ' + title);
  lines.push('期間: ' + formatDate_(startDate, 'yyyy/MM/dd') + ' - ' + formatDate_(endDate, 'yyyy/MM/dd'));
  lines.push('所要時間: ' + slotMinutes + '分');
  lines.push('');

  if (!slots || slots.length === 0) {
    lines.push('条件に合う空き時間が見つかりませんでした。別の期間で再度確認します。');
    return lines.join('\n');
  }

  slots.forEach(function(slot, index) {
    lines.push((index + 1) + '. ' + slot.label);
    lines.push(''); // 各候補の間に1行空ける
  });

  if (omittedCount > 0) {
    lines.push('');
    lines.push('ほかに ' + omittedCount + ' 件の候補があります。期間を短くすると見やすくなります。');
  }

  lines.push('');
  lines.push('例: 「2番の11時からでお願いします」');
  return lines.join('\n');
}

function sendCandidateConfirmGuide(replyToken) {
  sendReply(replyToken, "確定したい候補番号を送ってください。\n\n例: 2番\n例: 2番でお願いします");
}

function buildAvailabilityCheckText_(startDate, endDate, slotMinutes, slots, omittedCount) {
  const lines = [
    formatDate_(startDate, 'yyyy/MM/dd') + ' - ' + formatDate_(endDate, 'yyyy/MM/dd') + ' の空き時間です。',
    '所要時間: ' + slotMinutes + '分',
    ''
  ];

  if (!slots || slots.length === 0) {
    lines.push('条件に合う空き時間はありませんでした。');
    return lines.join('\n');
  }

  slots.forEach(function(slot, index) {
    lines.push((index + 1) + '. ' + slot.label);
    lines.push(''); // 各候補の間に1行空ける
  });

  if (omittedCount > 0) {
    lines.push('');
    lines.push('ほかに ' + omittedCount + ' 件の空きがあります。期間を短くすると見やすくなります。');
  }

  return lines.join('\n');
}

function sendLongTextReply_(replyToken, text) {
  const chunks = splitTextByLength_(text, 4500).slice(0, 5);
  if (splitTextByLength_(text, 4500).length > 5) {
    chunks[4] = chunks[4] + '\n\n候補が多いため一部のみ表示しています。期間を短くして再度確認してください。';
  }
  callLineAPI(replyToken, chunks.map(function(chunk) {
    return { type: 'text', text: chunk };
  }));
}

function splitTextByLength_(text, maxLength) {
  const lines = String(text || '').split('\n');
  const chunks = [];
  let current = '';

  lines.forEach(function(line) {
    const next = current ? current + '\n' + line : line;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  });

  if (current) chunks.push(current);
  return chunks;
}

function timeTextToMinutes_(timeText) {
  const parts = String(timeText || '').split(':').map(function(value) {
    return parseInt(value, 10);
  });
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minutesToTimeText_(minutes) {
  const total = Math.max(1, toNumber_(minutes, 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
}

/**
 * ログの手動クリア
 */
function clearLogs() {
  try {
    const ss = getSpreadsheet_();
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

// =========================================================
// AI秘書 Make API 追加実装
// =========================================================

/**
 * 既存GAS追加実装 Step1
 *
 * 目的:
 * - 既存のLINE予約・カレンダー同期を壊さず、AI秘書用の不足シートだけ追加する
 * - MakeからHTTP POSTで呼ばれた場合だけ、既存LINE Webhook処理とは別ルートで処理する
 *
 * 既存コード側にすでに存在する前提:
 * - const SS_ID
 * - function writeLog(tag, msg)
 *
 * 追加するシート:
 * - ルール管理
 * - 例外ルール
 * - Zoom管理
 * - 提案管理
 *
 * Step2で追加したMake API:
 * - getAvailableSlots: 空き時間候補を取得
 * - getRotatingZoomUrl: Zoom URLを古い順にローテーション取得
 *
 * Step3で追加したMake API:
 * - getScheduleForMake: 今日・明日・1週間の予定確認
 * - addManualSchedule: 手動予定追加
 * - createConfirmedSchedule: 確定予定作成とZoom URL取得
 *
 * Step5で追加した候補確定:
 * - getAvailableSlotsで候補を提案管理へ保存
 * - createConfirmedScheduleでproposalId + candidateNumberから予定確定
 */

function isMakeApiPayload_(json) {
  return json && !json.events && typeof json.action === 'string' && json.action !== '';
}

function handleMakeApiRequest_(payload) {
  try {
    writeLog('【Make API受信】', payload);

    let result;
    switch (payload.action) {
      case 'health':
        result = {
          message: 'GAS API is running.',
          timestamp: new Date().toISOString()
        };
        break;

      case 'setupAiSecretarySheets':
        result = setupAiSecretarySheets();
        break;

      case 'getAvailableSlots':
        result = getAvailableSlotsForMake_(payload);
        break;

      case 'getRotatingZoomUrl':
        result = getRotatingZoomUrlForMake_();
        break;

      case 'getScheduleForMake':
        result = getScheduleForMake_(payload);
        break;

      case 'addManualSchedule':
        result = addManualScheduleForMake_(payload);
        break;

      case 'createConfirmedSchedule':
        result = createConfirmedScheduleForMake_(payload);
        break;

      default:
        throw new Error('未対応のactionです: ' + payload.action);
    }

    return makeJsonOutput_({
      ok: true,
      action: payload.action,
      result: result
    });
  } catch (err) {
    writeLog('【Make APIエラー】', err.stack || err.message);
    return makeJsonOutput_({
      ok: false,
      action: payload ? payload.action : '',
      error: err.message
    });
  }
}

function makeJsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupAiSecretarySheets() {
  const ss = getSpreadsheet_();

  setupSettingsSheet_(ss);
  setupRuleManagementSheet_(ss);
  setupExceptionRuleSheet_(ss);
  setupZoomManagementSheet_(ss);
  setupProposalManagementSheet_(ss);
  getOrCreateUserSettingsSheet_(ss);

  writeLog('【AI秘書初期設定】', '不足シートの作成・確認が完了しました。');

  return {
    message: 'AI秘書用の不足シートを作成・確認しました。',
    sheets: ['設定', 'ルール管理', '例外ルール', 'Zoom管理', '提案管理', 'ユーザー設定']
  };
}

function setupSettingsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, '設定');
  const labels = [
    ['GoogleカレンダーID', '予定登録・予定確認に使うカレンダーID'],
    ['お問い合わせURL', 'お問い合わせボタンで開くURL'],
    ['代表Zoom URL', '個別Zoom URL未登録時の予備URL'],
    ['管理者メールアドレス', '通知や控えに使うメールアドレス'],
    ['サブスク登録URL', 'サブスク登録ボタンで開くURL'],
    ['サブスク案内文', 'サブスク登録ボタンに表示する文面'],
    ['既定の打ち合わせ時間（分）', '日程調整の初期値。例: 60'],
    ['予定前後バッファ（分）', '空き候補計算で前後に空ける時間。例: 0 または 30'],
    ['候補の最大表示数', '空欄ならLINE送信上限まで表示'],
    ['Zoom利用', 'TRUE / FALSE']
  ];

  const requiredRows = labels.length;
  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  }

  labels.forEach(function(row, index) {
    const rowNumber = index + 1;
    if (!String(sheet.getRange(rowNumber, 1).getValue() || '').trim()) {
      sheet.getRange(rowNumber, 1).setValue(row[0]);
    }
    if (!String(sheet.getRange(rowNumber, 3).getValue() || '').trim()) {
      sheet.getRange(rowNumber, 3).setValue(row[1]);
    }
  });
}

function setupRuleManagementSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, 'ルール管理');
  setHeaderIfEmpty_(sheet, ['曜日', '営業開始', '営業終了', '有効', 'メモ']);

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, 7, 5).setValues([
      ['月', '09:00', '18:00', true, ''],
      ['火', '09:00', '18:00', true, ''],
      ['水', '09:00', '18:00', true, ''],
      ['木', '09:00', '18:00', true, ''],
      ['金', '09:00', '18:00', true, ''],
      ['土', '', '', false, ''],
      ['日', '', '', false, '']
    ]);
  }
}

function setupExceptionRuleSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, '例外ルール');
  setHeaderIfEmpty_(sheet, ['日付', '開始', '終了', '種別', 'メモ']);

  if (sheet.getLastRow() <= 1) {
    sheet.appendRow(['2026/05/10', '13:00', '15:00', '空き', '記入例: 臨時で空ける時間']);
    sheet.appendRow(['2026/05/11', '10:00', '12:00', 'ブロック', '記入例: 外出など']);
  }
}

function setupZoomManagementSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, 'Zoom管理');
  setHeaderIfEmpty_(sheet, ['Zoom番号', 'Zoom URL', '最終使用日時', '有効', 'メモ']);

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, 5, 5).setValues([
      [1, 'YOUR_ZOOM_URL_1', '', true, ''],
      [2, 'YOUR_ZOOM_URL_2', '', true, ''],
      [3, 'YOUR_ZOOM_URL_3', '', true, ''],
      [4, 'YOUR_ZOOM_URL_4', '', true, ''],
      [5, 'YOUR_ZOOM_URL_5', '', true, '']
    ]);
  }
}

function setupProposalManagementSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, '提案管理');
  setHeaderIfEmpty_(sheet, ['提案ID', 'userId', '件名', '候補日時', 'ステータス', 'Zoom URL', '作成日時', '更新日時', '確定開始日時']);
}

function getOrCreateSheet_(ss, sheetName) {
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function setHeaderIfEmpty_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return;
  }

  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasAnyHeader = current.some(function(value) {
    return String(value || '').trim() !== '';
  });

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function test_setupAiSecretarySheets() {
  Logger.log(JSON.stringify(setupAiSecretarySheets(), null, 2));
}

function getAvailableSlotsForMake_(payload) {
  const ss = getSpreadsheet_();
  const calendarId = getCalendarIdFromSettings_(ss);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('カレンダーIDが正しくありません。設定シートB1を確認してください。');

  const slotMinutes = toNumber_(payload.slotMinutes, 60);
  const bufferMinutes = toNumber_(payload.bufferMinutes, 30);
  const maxResults = toNumber_(payload.maxResults, 5);
  const lookaheadDays = toNumber_(payload.lookaheadDays, 14);
  const weekOffset = getWeekOffset_(payload);

  const baseDate = payload.baseDate ? parseDateOnly_(payload.baseDate) : startOfDay_(new Date());
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);

  const businessRules = readBusinessRules_(ss);
  const exceptionRules = readExceptionRules_(ss);
  const slots = [];

  for (let i = 0; i < lookaheadDays && slots.length < maxResults; i++) {
    const targetDate = new Date(baseDate.getTime());
    targetDate.setDate(baseDate.getDate() + i);

    const openWindows = getOpenWindowsForDate_(targetDate, businessRules, exceptionRules);
    if (openWindows.length === 0) continue;

    const events = calendar.getEvents(startOfDay_(targetDate), endOfDay_(targetDate));
    const busyRanges = eventsToBusyRanges_(events, bufferMinutes);
    const exceptionBlocks = getExceptionBlocksForDate_(targetDate, exceptionRules);
    const blockedRanges = busyRanges.concat(exceptionBlocks);

    openWindows.forEach(function(window) {
      const candidates = splitWindowIntoSlots_(window.start, window.end, slotMinutes);
      candidates.forEach(function(slot) {
        if (slots.length >= maxResults) return;
        if (slot.start.getTime() < new Date().getTime()) return;
        if (!overlapsAny_(slot.start, slot.end, blockedRanges)) {
          slots.push(formatSlotForMake_(slot.start, slot.end));
        }
      });
    });
  }

  writeLog('【空き時間候補】', {
    count: slots.length,
    weekOffset: weekOffset,
    slotMinutes: slotMinutes,
    bufferMinutes: bufferMinutes
  });

  const proposalId = saveCandidateProposalForMake_(payload, slots, slotMinutes);

  return {
    proposalId: proposalId,
    slots: slots,
    text: buildAvailableSlotsText_(slots, payload.sourceType, proposalId),
    weekOffset: weekOffset,
    slotMinutes: slotMinutes,
    bufferMinutes: bufferMinutes
  };
}

function getRotatingZoomUrlForMake_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Zoom管理');
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error('Zoom管理シートにZoom URLがありません。');
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const candidates = [];

  values.forEach(function(row, index) {
    const zoomNumber = row[0];
    const zoomUrl = String(row[1] || '').trim();
    const lastUsedAt = row[2] ? new Date(row[2]) : null;
    const enabled = normalizeBoolean_(row[3]);

    if (!enabled) return;
    if (!zoomUrl || zoomUrl.indexOf('YOUR_ZOOM_URL') === 0) return;

    candidates.push({
      rowNumber: index + 2,
      zoomNumber: zoomNumber,
      zoomUrl: zoomUrl,
      lastUsedAt: lastUsedAt
    });
  });

  if (candidates.length === 0) {
    throw new Error('有効なZoom URLがありません。Zoom管理シートを確認してください。');
  }

  candidates.sort(function(a, b) {
    const aTime = a.lastUsedAt ? a.lastUsedAt.getTime() : 0;
    const bTime = b.lastUsedAt ? b.lastUsedAt.getTime() : 0;
    return aTime - bTime;
  });

  const selected = candidates[0];
  const now = new Date();
  sheet.getRange(selected.rowNumber, 3).setValue(now);

  writeLog('【Zoom URL取得】', 'Zoom番号 ' + selected.zoomNumber + ' を使用しました。');

  return {
    zoomNumber: selected.zoomNumber,
    zoomUrl: selected.zoomUrl,
    usedAt: Utilities.formatDate(now, 'JST', 'yyyy/MM/dd HH:mm:ss')
  };
}

function getCalendarIdFromSettings_(ss) {
  const sheet = ss.getSheetByName('設定');
  if (!sheet) throw new Error('設定シートが見つかりません。');

  const calendarId = String(sheet.getRange('B1').getValue() || '').trim();
  if (!calendarId) throw new Error('設定シートB1にカレンダーIDを入力してください。');

  return calendarId;
}

function readBusinessRules_(ss) {
  const sheet = ss.getSheetByName('ルール管理');
  if (!sheet || sheet.getLastRow() <= 1) return {};

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const rules = {};

  rows.forEach(function(row) {
    const dayName = String(row[0] || '').trim();
    if (!dayName) return;

    rules[dayName] = {
      start: normalizeTime_(row[1]),
      end: normalizeTime_(row[2]),
      enabled: normalizeBoolean_(row[3])
    };
  });

  return rules;
}

function readExceptionRules_(ss) {
  const sheet = ss.getSheetByName('例外ルール');
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  return rows
    .filter(function(row) {
      return row[0] && row[1] && row[2] && row[3];
    })
    .map(function(row) {
      return {
        date: formatDate_(row[0], 'yyyy/MM/dd'),
        start: normalizeTime_(row[1]),
        end: normalizeTime_(row[2]),
        type: String(row[3] || '').trim(),
        memo: String(row[4] || '')
      };
    });
}

function getOpenWindowsForDate_(date, businessRules, exceptionRules) {
  const dayName = getJapaneseDayName_(date);
  const dateKey = formatDate_(date, 'yyyy/MM/dd');
  const windows = [];
  const rule = businessRules[dayName];

  if (rule && rule.enabled && rule.start && rule.end) {
    windows.push({
      start: combineDateAndTime_(date, rule.start),
      end: combineDateAndTime_(date, rule.end)
    });
  }

  exceptionRules.forEach(function(rule) {
    if (rule.date !== dateKey) return;
    if (rule.type === '空き') {
      windows.push({
        start: combineDateAndTime_(date, rule.start),
        end: combineDateAndTime_(date, rule.end)
      });
    }
  });

  return windows.filter(function(window) {
    return window.end.getTime() > window.start.getTime();
  });
}

function getExceptionBlocksForDate_(date, exceptionRules) {
  const dateKey = formatDate_(date, 'yyyy/MM/dd');
  return exceptionRules
    .filter(function(rule) {
      return rule.date === dateKey && rule.type === 'ブロック';
    })
    .map(function(rule) {
      return {
        start: combineDateAndTime_(date, rule.start),
        end: combineDateAndTime_(date, rule.end)
      };
    });
}

function eventsToBusyRanges_(events, bufferMinutes) {
  return events.map(function(event) {
    return {
      start: new Date(event.getStartTime().getTime() - bufferMinutes * 60000),
      end: new Date(event.getEndTime().getTime() + bufferMinutes * 60000)
    };
  });
}

function getAvailableContinuousBlocks_(start, end, blockedRanges, minMinutes) {
  const sortedBlocks = blockedRanges.slice().sort(function(a, b) {
    return a.start.getTime() - b.start.getTime();
  });

  const availableBlocks = [];
  let currentStart = new Date(start.getTime());

  for (let i = 0; i < sortedBlocks.length; i++) {
    const block = sortedBlocks[i];
    
    if (block.end.getTime() <= currentStart.getTime()) continue;
    
    if (block.start.getTime() > currentStart.getTime()) {
      if (block.start.getTime() - currentStart.getTime() >= minMinutes * 60000) {
        availableBlocks.push({
          start: new Date(currentStart.getTime()),
          end: new Date(block.start.getTime())
        });
      }
    }
    
    if (block.end.getTime() > currentStart.getTime()) {
      currentStart = new Date(block.end.getTime());
    }
    
    if (currentStart.getTime() >= end.getTime()) break;
  }

  if (currentStart.getTime() < end.getTime()) {
    if (end.getTime() - currentStart.getTime() >= minMinutes * 60000) {
      availableBlocks.push({
        start: new Date(currentStart.getTime()),
        end: new Date(end.getTime())
      });
    }
  }

  return availableBlocks;
}

function overlapsAny_(start, end, ranges) {
  return ranges.some(function(range) {
    return start.getTime() < range.end.getTime() && end.getTime() > range.start.getTime();
  });
}

function buildAvailableSlotsText_(slots, sourceType, proposalId) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  if (!slots || slots.length === 0) {
    lines.push('条件に合う空き時間が見つかりませんでした。別の日程で再度確認します。');
    return lines.join('\n');
  }

  lines.push('候補日時はこちらです。');
  if (proposalId) lines.push('提案ID: ' + proposalId);
  slots.forEach(function(slot, index) {
    lines.push((index + 1) + '. ' + slot.label);
  });
  lines.push('');
  lines.push('ご都合のよい番号をお知らせください。');

  return lines.join('\n');
}

function formatSlotForMake_(start, end) {
  return {
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm'),
    label: formatDate_(start, 'MM/dd') + '(' + getJapaneseDayName_(start) + ') ' + formatDate_(start, 'HH:mm') + ' - ' + formatDate_(end, 'HH:mm')
  };
}

function getWeekOffset_(payload) {
  if (payload.weekOffset !== undefined && payload.weekOffset !== '') {
    return toNumber_(payload.weekOffset, 0);
  }

  const text = String(payload.text || payload.keyword || '');
  return text.indexOf('次週') !== -1 || text.indexOf('来週') !== -1 ? 1 : 0;
}

function parseDateOnly_(value) {
  if (value instanceof Date) return startOfDay_(value);

  const date = new Date(String(value).replace(/-/g, '/') + ' 00:00:00');
  if (isNaN(date.getTime())) throw new Error('日付形式が正しくありません: ' + value);
  return date;
}

function combineDateAndTime_(date, timeText) {
  const parts = normalizeTime_(timeText).split(':');
  const result = startOfDay_(date);
  result.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
  return result;
}

function normalizeTime_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'JST', 'HH:mm');
  }

  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';

  return ('0' + Number(match[1])).slice(-2) + ':' + match[2];
}

function normalizeBoolean_(value) {
  if (value === true) return true;
  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === '有効';
}

function startOfDay_(date) {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay_(date) {
  const result = new Date(date.getTime());
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatDate_(date, pattern) {
  return Utilities.formatDate(new Date(date), 'JST', pattern);
}

function getJapaneseDayName_(date) {
  return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
}

function toNumber_(value, defaultValue) {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

function test_getAvailableSlotsForMake() {
  Logger.log(JSON.stringify(getAvailableSlotsForMake_({
    slotMinutes: 60,
    bufferMinutes: 30,
    maxResults: 5,
    weekOffset: 0
  }), null, 2));
}

function test_getRotatingZoomUrlForMake() {
  Logger.log(JSON.stringify(getRotatingZoomUrlForMake_(), null, 2));
}

function getScheduleForMake_(payload) {
  const ss = getSpreadsheet_();
  const calendarId = getCalendarIdFromSettings_(ss);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('カレンダーIDが正しくありません。設定シートB1を確認してください。');

  const period = resolveSchedulePeriodForMake_(payload);
  const events = calendar.getEvents(period.start, period.end);
  const schedules = events.map(function(event) {
    return {
      title: event.getTitle(),
      start: formatDate_(event.getStartTime(), 'yyyy/MM/dd HH:mm'),
      end: formatDate_(event.getEndTime(), 'yyyy/MM/dd HH:mm'),
      allDay: event.isAllDayEvent(),
      description: event.getDescription() || ''
    };
  });

  writeLog('【予定確認API】', {
    range: payload.range || 'today',
    count: schedules.length
  });

  return {
    range: payload.range || 'today',
    label: period.label,
    schedules: schedules,
    text: buildScheduleTextForMake_(period.label, schedules, payload.sourceType)
  };
}

function addManualScheduleForMake_(payload) {
  validateSchedulePayloadForMake_(payload);

  const ss = getSpreadsheet_();
  const calendarId = getCalendarIdFromSettings_(ss);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('カレンダーIDが正しくありません。設定シートB1を確認してください。');

  const title = String(payload.title || '').trim();
  const start = parseDateTime_(payload.start);
  const end = payload.end
    ? parseDateTime_(payload.end)
    : new Date(start.getTime() + toNumber_(payload.durationMinutes, 60) * 60000);

  if (end.getTime() <= start.getTime()) {
    throw new Error('終了日時は開始日時より後にしてください。');
  }

  const description = String(payload.description || 'Makeから手動追加').trim();
  const event = calendar.createEvent(title, start, end, {
    description: description
  });

  writeLog('【手動予定追加API】', {
    title: title,
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm')
  });

  return {
    eventId: event.getId(),
    title: title,
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm'),
    text: buildManualAddedTextForMake_(title, start, end, payload.sourceType)
  };
}

function createConfirmedScheduleForMake_(payload) {
  const resolved = resolveConfirmedSchedulePayload_(payload);
  validateSchedulePayloadForMake_(resolved);

  const ss = getSpreadsheet_();
  const calendarId = getCalendarIdFromSettings_(ss);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('カレンダーIDが正しくありません。設定シートB1を確認してください。');

  const title = String(resolved.title || '').trim();
  const start = parseDateTime_(resolved.start);
  const end = resolved.end
    ? parseDateTime_(resolved.end)
    : new Date(start.getTime() + toNumber_(resolved.durationMinutes, 60) * 60000);

  if (end.getTime() <= start.getTime()) {
    throw new Error('終了日時は開始日時より後にしてください。');
  }

  let zoomUrl = String(resolved.zoomUrl || '').trim();
  if (!zoomUrl && resolved.useZoom !== false) {
    zoomUrl = getRotatingZoomUrlForMake_().zoomUrl;
  }

  const descriptionLines = [];
  if (resolved.description) descriptionLines.push(String(resolved.description));
  if (zoomUrl) descriptionLines.push('Zoom: ' + zoomUrl);

  const event = calendar.createEvent(title, start, end, {
    description: descriptionLines.join('\n')
  });

  markProposalConfirmedForMake_(resolved, event.getId(), zoomUrl, start);

  writeLog('【確定予定作成API】', {
    title: title,
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm'),
    hasZoom: !!zoomUrl
  });

  return {
    eventId: event.getId(),
    title: title,
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm'),
    zoomUrl: zoomUrl,
    proposalId: resolved.proposalId || '',
    candidateNumber: resolved.candidateNumber || null,
    text: buildConfirmedScheduleTextForMake_(title, start, end, zoomUrl, resolved.sourceType)
  };
}

function resolveSchedulePeriodForMake_(payload) {
  const range = String(payload.range || 'today').trim();
  const now = new Date();

  if (payload.startDate && payload.endDate) {
    const customStart = startOfDay_(parseDateOnly_(payload.startDate));
    const customEnd = endOfDay_(parseDateOnly_(payload.endDate));
    return {
      start: customStart,
      end: customEnd,
      label: formatDate_(customStart, 'yyyy/MM/dd') + ' - ' + formatDate_(customEnd, 'yyyy/MM/dd') + ' の予定'
    };
  }

  if (range === 'tomorrow' || range === '明日') {
    const date = addDays_(now, 1);
    return {
      start: startOfDay_(date),
      end: endOfDay_(date),
      label: '明日の予定'
    };
  }

  if (range === 'week' || range === '1週間' || range === '一週間') {
    return {
      start: startOfDay_(now),
      end: endOfDay_(addDays_(now, 7)),
      label: '1週間の予定'
    };
  }

  return {
    start: startOfDay_(now),
    end: endOfDay_(now),
    label: '今日の予定'
  };
}

function buildScheduleTextForMake_(label, schedules, sourceType) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  lines.push('[' + label + ']');
  lines.push('');

  if (!schedules || schedules.length === 0) {
    lines.push('予定はありません。');
    return lines.join('\n');
  }

  schedules.forEach(function(item) {
    lines.push(item.start + ' - ' + item.end);
    lines.push(item.title);
    if (item.description) lines.push(item.description);
    lines.push('');
  });

  return lines.join('\n').trim();
}

function buildManualAddedTextForMake_(title, start, end, sourceType) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  lines.push('予定を登録しました。');
  lines.push('件名: ' + title);
  lines.push('日時: ' + formatDate_(start, 'yyyy/MM/dd HH:mm') + ' - ' + formatDate_(end, 'HH:mm'));

  return lines.join('\n');
}

function buildConfirmedScheduleTextForMake_(title, start, end, zoomUrl, sourceType) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  lines.push('日程が確定しました。');
  lines.push('件名: ' + title);
  lines.push('日時: ' + formatDate_(start, 'yyyy/MM/dd HH:mm') + ' - ' + formatDate_(end, 'HH:mm'));
  if (zoomUrl) lines.push('Zoom: ' + zoomUrl);

  return lines.join('\n');
}

function validateSchedulePayloadForMake_(payload) {
  if (!payload.title || String(payload.title).trim() === '') {
    throw new Error('title が必要です。');
  }
  if (!payload.start || String(payload.start).trim() === '') {
    throw new Error('start が必要です。例: 2026/05/10 13:00');
  }
}

function saveCandidateProposalForMake_(payload, slots, slotMinutes) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('提案管理');
  if (!sheet) return '';
  if (!slots || slots.length === 0) return '';

  const proposalId = payload.proposalId || createProposalId_();
  const now = new Date();
  const title = String(payload.title || payload.subject || '日程調整').trim();
  const data = {
    slots: slots,
    title: title,
    durationMinutes: slotMinutes,
    sourceType: payload.sourceType || '',
    urlType: payload.urlType || 'zoom',
    userId: payload.userId || '',
    createdAt: now.toISOString()
  };

  sheet.appendRow([
    proposalId,
    payload.userId || '',
    title,
    JSON.stringify(data),
    '候補提示',
    '',
    now,
    now
  ]);

  return proposalId;
}

function resolveConfirmedSchedulePayload_(payload) {
  if (payload.proposalId && payload.candidateNumber) {
    const proposal = findProposalForMake_(payload.proposalId);
    const candidateIndex = toNumber_(payload.candidateNumber, 1) - 1;
    if (candidateIndex < 0 || candidateIndex >= proposal.slots.length) {
      throw new Error('候補番号が範囲外です: ' + payload.candidateNumber);
    }

    const selected = proposal.slots[candidateIndex];
    let finalStart = selected.start;
    let finalEnd = selected.end;
    const duration = payload.durationMinutes || proposal.durationMinutes || 60;

    // AIが抽出した「開始希望時刻」がある場合、ブロックの開始時間をそれで上書きし、終了時間を計算する
    if (payload.candidateTime) {
      const dateStr = String(selected.start).split(' ')[0]; // "yyyy/MM/dd" 部分を抽出
      finalStart = dateStr + ' ' + payload.candidateTime;
      const startDateObj = new Date(finalStart.replace(/-/g, '/'));
      finalEnd = formatDate_(new Date(startDateObj.getTime() + duration * 60000), 'yyyy/MM/dd HH:mm');
    }

    return {
      proposalId: payload.proposalId,
      candidateNumber: payload.candidateNumber,
      title: payload.title || proposal.title || '日程調整',
      start: finalStart,
      end: finalEnd,
      durationMinutes: duration,
      useZoom: payload.useZoom,
      zoomUrl: payload.zoomUrl || '',
      description: payload.description || '提案ID: ' + payload.proposalId,
      sourceType: payload.sourceType || proposal.sourceType || '',
      userId: payload.userId || proposal.userId || ''
    };
  }

  return payload;
}

function findProposalForMake_(proposalId) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('提案管理');
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error('提案管理シートに候補がありません。');
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]) !== String(proposalId)) continue;

      const raw = String(rows[i][3] || '');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error('提案ID ' + proposalId + ' の候補データを読み取れません。');
      }

      return {
        rowNumber: i + 2,
        proposalId: proposalId,
        userId: rows[i][1] || parsed.userId || '',
        title: rows[i][2] || parsed.title || '',
        slots: parsed.slots || [],
        durationMinutes: parsed.durationMinutes || 60,
        sourceType: parsed.sourceType || '',
        status: rows[i][4] || ''
      };
  }

  throw new Error('提案IDが見つかりません: ' + proposalId);
}

function markProposalConfirmedForMake_(payload, eventId, zoomUrl, start) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('提案管理');
  if (!sheet) return;

  const now = new Date();

  if (payload.proposalId) {
    try {
      const proposal = findProposalForMake_(payload.proposalId);
      sheet.getRange(proposal.rowNumber, 5).setValue('確定');
      sheet.getRange(proposal.rowNumber, 6).setValue(zoomUrl || '');
      sheet.getRange(proposal.rowNumber, 8).setValue(now);
      sheet.getRange(proposal.rowNumber, 9).setValue(start); // リマインド用に記録
      return;
    } catch (err) {
      writeLog('【提案管理更新エラー】', err.message);
    }
  }

  sheet.appendRow([
    payload.proposalId || eventId,
    payload.userId || '',
    payload.title || '',
    formatDate_(start, 'yyyy/MM/dd HH:mm'),
    '確定',
    zoomUrl || '',
    now,
    now,
    start // リマインド用に記録
  ]);
}

function createProposalId_() {
  return 'P' + Utilities.formatDate(new Date(), 'JST', 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 8);
}

function parseDateTime_(value) {
  if (value instanceof Date) return value;

  const date = new Date(String(value).replace(/-/g, '/').replace('T', ' '));
  if (isNaN(date.getTime())) throw new Error('日時形式が正しくありません: ' + value);
  return date;
}

function addDays_(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function test_getScheduleForMake() {
  Logger.log(JSON.stringify(getScheduleForMake_({
    range: 'today',
    sourceType: 'group'
  }), null, 2));
}

function test_addManualScheduleForMake() {
  Logger.log(JSON.stringify(addManualScheduleForMake_({
    title: 'テスト予定',
    start: formatDate_(addDays_(new Date(), 1), 'yyyy/MM/dd') + ' 13:00',
    durationMinutes: 30,
    sourceType: 'group'
  }), null, 2));
}

/**
 * 【ステップ3】直近の会話履歴を取得する
 * @param {string} userId LINEのユーザーID
 * @param {number} limit 取得するラリー数（デフォルト10件）
 * @return {Array} OpenAIのmessages形式の配列 [{role: "...", content: "..."}, ...]
 */
function getConversationHistory_(userId, limit = 10) {
  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName('会話ログ');
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return []; // ヘッダーのみ、または空の場合

    // シート全行をスキャンするのは重いため、最新500行分だけメモリに読み込む
    const maxReadRows = 500;
    const readRows = Math.min(lastRow - 1, maxReadRows);
    const startRow = lastRow - readRows + 1;
    
    // A〜D列を取得 (日時, ユーザーID, 役割, メッセージ)
    const data = sheet.getRange(startRow, 1, readRows, 4).getValues();
    
    const history = [];
    // 下から（最新のものから）検索
    for (let i = data.length - 1; i >= 0; i--) {
      const rowUserId = String(data[i][1]).trim();
      if (rowUserId === String(userId).trim()) {
        const role = String(data[i][2]).trim() === 'assistant' ? 'assistant' : 'user';
        const content = String(data[i][3]).trim();
        if (content) {
          history.push({ role: role, content: content });
        }
        if (history.length >= limit) break; // 指定件数に達したら終了
      }
    }
    
    // 古い順に並び替えて返す
    return history.reverse();
  } catch (err) {
    writeLog("【会話ログ取得エラー】", err.message);
    return [];
  }
}

function test_getConversationHistory() {
  const history = getConversationHistory_('U_TEST_USER_ID', 5);
  Logger.log(history);
}

/**
 * 【ステップ4】OpenAI APIを呼び出して回答を生成する
 * @param {string} userId LINEのユーザーID
 * @param {string} userMessage 今回送信されたメッセージ
 * @param {Array} history 過去の会話履歴 (getConversationHistory_ の戻り値)
 * @return {string} AIからの返答テキスト
 */
function callOpenAI_(userId, userMessage, history = []) {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY が設定されていません。スクリプトプロパティを確認してください。');
    }

    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    // システムプロンプト（スケジュール調整に特化、リスケの案内などを含める）
    const systemPrompt = `あなたは優秀なスケジュール調整AI秘書です。
ユーザーやグループメンバーからの日程調整の依頼に対して、丁寧に対応してください。
案内を出す際は「ご都合が悪い場合は『リスケ』とご入力ください」など、事前にリスケの指示方法を伝えるようにしてください。

【重要：システム連携コマンド】
システムにカレンダー操作を行わせるため、以下の条件に当てはまる場合は、返答メッセージの【最後】に必ず該当するコマンド文字列を付与してください。
1. 日程の空き候補を取得して相手に提案したい場合
   [COMMAND:PROPOSE]
2. 相手が提案リストの番号と開始希望時刻を指定して、予定を確定させたい場合（例：「1番の11時から」）
   [COMMAND:CONFIRM, NUMBER:選ばれた番号の数字, TIME:開始時刻(HH:mm形式)]
3. 相手から都合が悪いと言われ、1週間先の予定でリスケをしたい場合
   [COMMAND:RESCHEDULE]
※通常の挨拶や質問への回答の場合はコマンドは不要です。`;

    // メッセージ配列の構築
    const messages = [];
    messages.push({ role: "system", content: systemPrompt });
    
    // 過去の履歴を追加
    if (history && history.length > 0) {
      history.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }
    
    // 今回のメッセージを追加
    messages.push({ role: "user", content: userMessage });

    const payload = {
      model: "gpt-4o-mini", // コストパフォーマンスに優れたモデル
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    };

    const options = {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`OpenAI API エラー (HTTP ${responseCode}): ${responseBody}`);
    }

    const json = JSON.parse(responseBody);
    if (json.choices && json.choices.length > 0) {
      return json.choices[0].message.content.trim();
    } else {
      throw new Error('OpenAI API から不正なレスポンスが返されました。');
    }
  } catch (err) {
    // ユーザーのご指示通り、APIエラーは必ず「エラー履歴」シートに残るようにする
    writeLog("【OpenAI API呼出エラー】", err.message);
    return "申し訳ありません、現在AI秘書システムが混み合っております。少し時間をおいて再度お試しください。";
  }
}

function test_callOpenAI() {
  const res = callOpenAI_("TEST_USER", "こんにちは、テストメッセージです。");
  Logger.log(res);
}

// =========================================================
// AI秘書 フェーズ4 追加実装（リマインド機能）
// =========================================================

/**
 * 予定の約3時間前にLINEでリマインドを送信するバッチ処理
 */
function sendReminders_() {
  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName('提案管理');
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    const now = new Date();
    
    // 現在時刻から「3時間後」〜「4時間後」の間を開始時間とする予定を探す
    // (1時間ごとのトリガー実行を想定し、1時間の幅を持たせる)
    const targetStart = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const targetEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const proposalId = row[0];
      const userId = row[1];
      const title = row[2];
      const status = String(row[4] || '');
      const zoomUrl = row[5];
      const startObj = row[8]; // I列: 確定開始日時

      // ステータスが確定であり、まだリマインドしていないもの
      if (status === '確定' && startObj) {
        const startTime = new Date(startObj);
        if (!isNaN(startTime.getTime())) {
          // 予定の開始時刻がターゲット期間内に含まれるかチェック
          if (startTime.getTime() >= targetStart.getTime() && startTime.getTime() < targetEnd.getTime()) {
            if (userId) {
              const formattedTime = Utilities.formatDate(startTime, 'JST', 'MM/dd HH:mm');
              let msg = `【リマインド】\nまもなく以下の予定のお時間となります。\n\n${title}\n日時: ${formattedTime}`;
              if (zoomUrl) {
                msg += `\nZoom: ${zoomUrl}`;
              }
              
              sendPushMessage(userId, msg);
              writeLog("【リマインド送信】", { userId: userId, proposalId: proposalId, time: formattedTime });
            }
            
            // リマインド済みに更新して二重送信を防ぐ
            sheet.getRange(i + 2, 5).setValue('確定(リマインド済)');
          }
        }
      }
    }
  } catch (err) {
    writeLog("【リマインドシステムエラー】", err.message);
  }
}

/**
 * 1時間ごとのリマインド実行トリガーを設定する
 * ※この関数をGASエディタから手動で1回実行してください
 */
function setupReminderTrigger() {
  const functionName = 'sendReminders_';
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyHours(1)
    .create();
    
  Logger.log('リマインド用トリガー（1時間間隔）を設定しました。');
}
