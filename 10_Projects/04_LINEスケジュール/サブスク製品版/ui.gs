/**
 * @file ui.gs
 * @description 🚚 運用担当：LINEインターフェースとテンプレート送付
 */

const LINE_TOKEN = 'iR7vPwaizF+JujidhAQxaq/jhzCCt+Ded1cnmXeTECqjzRusOF+rArPq1h8bIBs/MhpzqZ36JVNHHeC/viTPblbrDCH4kWjQEsL/FkkwTNl/Ig1bBoChfQPxbACBFKsdJVL011VeYI3xfFP4dndvBgdB04t89/1O/w1cDnyilFU=';

/**
 * テキスト返信の送信
 */
function sendReply(replyToken, msg) {
  callLineAPI(replyToken, [{ 'type': 'text', 'text': msg }]);
}

/**
 * 汎用LINE API呼び出し
 */
function callLineAPI(replyToken, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINE_TOKEN
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': messages
    })
  });
}

/**
 * ユーザーへプッシュ通知を送信
 */
function pushMessage(userId, msg) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINE_TOKEN
    },
    'method': 'post',
    'payload': JSON.stringify({
      'to': userId,
      'messages': [{ 'type': 'text', 'text': msg }]
    })
  });
}

/**
 * 月選択メニュー
 */
function sendMonthSelection(replyToken) {
  callLineAPI(replyToken, [{
    'type': 'template', 'altText': '月選択',
    'template': {
      'type': 'buttons', 'text': 'いつの予約ですか？',
      'actions': [
        { 'type': 'postback', 'label': '今月', 'data': 'action=choose_month=now' },
        { 'type': 'postback', 'label': '来月', 'data': 'action=choose_month=next' },
        { 'type': 'postback', 'label': '任意', 'data': 'action=choose_month=manual' }
      ]
    }
  }]);
}

/**
 * 日時選択（過去日制限付き）
 */
function sendDateTimePicker(replyToken, type) {
  const now = new Date();
  let initial = Utilities.formatDate(now, 'JST', "yyyy-MM-dd'T'HH:mm");
  const min = Utilities.formatDate(now, 'JST', "yyyy-MM-dd'T'HH:mm");
  
  if (type === 'next') initial = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0), 'JST', "yyyy-MM-dd'T'HH:mm");
  
  callLineAPI(replyToken, [{
    'type': 'template', 'altText': '日時選択',
    'template': {
      'type': 'buttons', 'text': '日時を選んでください',
      'actions': [{
        'type': 'datetimepicker',
        'label': '決定',
        'data': 'action=select_date',
        'mode': 'datetime',
        'initial': initial,
        'min': min
      }]
    }
  }]);
}

/**
 * Google Meet要否選択
 */
function sendMeetChoice(replyToken) {
  // Proプラン判定は logic.gs で行う
  callLineAPI(replyToken, [{
    'type': 'template', 'altText': 'Meet要否',
    'template': {
      'type': 'buttons', 'text': 'Google Meetを発行しますか？',
      'actions': [
        { 'type': 'postback', 'label': 'はい', 'data': 'action=set_meet=yes' },
        { 'type': 'postback', 'label': 'いいえ', 'data': 'action=set_meet=no' }
      ]
    }
  }]);
}

/**
 * お問い合わせメニュー
 */
const INQUIRY_FORM_URL = "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform";

function sendInquiryMenu(replyToken) {
  callLineAPI(replyToken, [{
    'type': 'template', 'altText': 'お問い合わせ',
    'template': {
      'type': 'buttons',
      'title': 'お問い合わせ',
      'text': 'トラブルや改善要望はこちらのフォームよりお送りください。',
      'actions': [
        { 'type': 'uri', 'label': 'フォームを開く', 'uri': INQUIRY_FORM_URL }
      ]
    }
  }]);
}
