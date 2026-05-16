// ==========================================
// 初心者向け：スプレッドシート連携用 Google Apps Script
// ==========================================

// 1. このコードの準備手順
// ① Googleドライブを開き、「新規」>「Google スプレッドシート」を作成します。
// ② スプレッドシートの1行目に、左から順に見出しを書きます（A1: 送信日時, B1: 名前(漢字), C1: 名前(カナ), D1: 生年月日 ...など）
// ③ 上のメニューから「拡張機能」>「Apps Script」をクリックします。
// ④ 最初から書かれているコードをすべて消して、このコードを貼り付けます。
// ⑤ 左上の「プロジェクト名」を「問診アプリ連携」などに変更し、保存（Ctrl+S またはフロッピーアイコン）します。

// 2. Webアプリとして公開する手順
// ① 右上の青い「デプロイ」ボタン >「新しいデプロイ」をクリックします。
// ② 左側の歯車マーク⚙️をクリックし、「ウェブアプリ」を選びます。
// ③ 以下の設定にして「デプロイ」を押します。
//    - アクセスできるユーザー: 「全員」
// ④ アクセス承認の画面が出たら「アクセスを承認」> 自分のGoogleアカウントを選択 > 左下の「詳細」>「安全ではないページに移動（または移動）」>「許可」を押します。
// ⑤ 最後に表示される「ウェブアプリのURL」をコピーします。これをアプリ側の script.js の指定の場所に貼り付けます。

function doPost(e) {
  // アプリから送られてきたデータを受け取る
  // 送られてくるデータ（JSON）をプログラムで扱える形に変換します
  const data = JSON.parse(e.postData.contents);
  
  // 現在開いているスプレッドシートを取得
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // 現在の日時を取得（いつ送信されたか記録するため）
  const timestamp = new Date();
  
  // スプレッドシートの最後に新しい行を追加する（順番はアプリ側から送るデータに合わせます）
  // 以下の順番でA列から横に並んで記録されます
  sheet.appendRow([
    timestamp,                 // A列: 送信日時
    data.name_kanji,           // B列: お名前（漢字）
    data.name_kana,            // C列: お名前（カナ）
    data.dob,                  // D列: 生年月日
    data.phone,                // E列: 電話番号
    data.first_visit,          // F列: 初診かどうか
    data.reason,               // G列: 来院理由
    data.when_pain,            // H列: いつから痛いか
    data.pain_level,           // I列: 痛みの程度
    data.pain_area,            // J列: 気になる箇所
    data.disease,              // K列: 抱えている病気
    data.allergy,              // L列: アレルギー
    data.medicine,             // M列: 服用中の薬
    data.request               // N列: 治療への希望
  ]);
  
  // アプリ側に「成功しました」という結果を返す
  return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}
