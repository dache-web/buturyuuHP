/**
 * @file payment.gs
 * @description 💳 サブスク担当：フィンコード連携ロジック
 */

const FINCODE_SECRET_KEY = 'YOUR_FINCODE_SECRET_KEY'; // 管理画面より取得

/**
 * サブスクリプション管理メニューの送信
 */
function sendSubscriptionMenu(replyToken, userId) {
  const userInfo = getUserPlan(userId);
  let statusText = "プラン：未登録";
  if (userInfo.plan === 'Standard') statusText = "プラン：スタンダード (月額980円)";
  if (userInfo.plan === 'Pro') statusText = "プラン：Pro (月額1980円)";

  callLineAPI(replyToken, [{
    'type': 'template', 'altText': 'サブスク設定',
    'template': {
      'type': 'buttons',
      'title': 'サブスクリプション',
      'text': statusText + "\n10件以上のご利用や高機能版はこちらから登録できます。",
      'actions': [
        { 'type': 'postback', 'label': 'Proプラン登録(初月無料)', 'data': 'action=reg_sub=Pro' },
        { 'type': 'postback', 'label': 'スタンダード登録', 'data': 'action=reg_sub=Standard' },
        { 'type': 'uri', 'label': '詳細・解約はこちら', 'uri': 'https://example.com/sub-portal?uid=' + userId }
      ]
    }
  }]);
}

/**
 * 決済URLの発行と送信 (Fincode Checkout)
 * 実際の実装ではここでAPIを叩いてURLを生成します
 */
function handleSubscriptionRegistration(replyToken, userId, plan) {
  // TODO: フィンコードAPIを使用してチェックアウトURLを発行
  // 初月無料の場合: initial_amount = 0
  
  const msg = `【${plan}プラン登録】\n以下のURLからクレジットカード情報の登録をお願いします。\n登録完了後、機能が自動的に有効化されます。\n\nhttps://example.com/checkout?user=${userId}&plan=${plan}`;
  sendReply(replyToken, msg);
}
