# LINE秘書 新規案件 GAS API 使い方

このフォルダの `code.gs` は、新規案件用のGoogle Apps Scriptです。
既存案件のGASやスプレッドシートID、LINEトークン、Webhook URLは使い回しません。

## 初回セットアップ

1. 新しいGoogleスプレッドシートを作成します。
2. 新しいGoogle Apps Scriptプロジェクトを作成します。
3. `code.gs` の中身を貼り付けます。
4. 必要であれば `appsscript.json` も同じ内容にします。
5. `SS_ID` を新しいスプレッドシートIDに変更します。
6. `setupInitialSheets()` を1回実行します。
7. 作成された `設定` シートにカレンダーIDなどを入力します。
8. Webアプリとしてデプロイし、URLをMakeで使います。

## Makeから呼ぶ共通形式

MakeのHTTPモジュールから、GAS WebアプリURLへ `POST` します。

ヘッダー:

```text
Content-Type: application/json
```

本文はJSONで送ります。

## 1. 初期シート作成

```json
{
  "action": "setupInitialSheets"
}
```

## 2. 空き時間候補取得

```json
{
  "action": "getAvailableSlots",
  "title": "商談",
  "userId": "USER_ID_FROM_LINE",
  "slotMinutes": 60,
  "bufferMinutes": 30,
  "maxResults": 5,
  "weekOffset": 0,
  "sourceType": "group"
}
```

次週で探す場合:

```json
{
  "action": "getAvailableSlots",
  "slotMinutes": 60,
  "bufferMinutes": 30,
  "maxResults": 5,
  "weekOffset": 1
}
```

## 3. リスケ候補取得

```json
{
  "action": "getRescheduleCandidates",
  "keyword": "次週でリスケしたい",
  "slotMinutes": 60,
  "maxResults": 5
}
```

## 4. Zoom URLローテーション取得

```json
{
  "action": "getRotatingZoomUrl"
}
```

## 5. 予定確認

今日:

```json
{
  "action": "getSchedule",
  "range": "today"
}
```

明日:

```json
{
  "action": "getSchedule",
  "range": "tomorrow"
}
```

1週間:

```json
{
  "action": "getSchedule",
  "range": "week"
}
```

## 6. 手動予定追加

```json
{
  "action": "addManualSchedule",
  "title": "会議",
  "start": "2026/05/10 13:00",
  "durationMinutes": 60,
  "description": "Makeから登録"
}
```

## 7. 確定予定作成とZoom発行

候補取得で返った `proposalId` と、ユーザーが選んだ番号を渡すと、その候補日時で確定できます。

```json
{
  "action": "createConfirmedSchedule",
  "proposalId": "P20260502083000-abc12345",
  "candidateNumber": 1,
  "title": "商談",
  "useZoom": true,
  "sourceType": "group",
  "userId": "USER_ID_FROM_LINE"
}
```

日時を直接指定して確定する場合:

```json
{
  "action": "createConfirmedSchedule",
  "title": "商談",
  "start": "2026/05/10 13:00",
  "durationMinutes": 60,
  "useZoom": true,
  "sourceType": "group",
  "userId": "USER_ID_FROM_LINE"
}
```

個人LINEで、転送用の前置きを付けたい場合:

```json
{
  "action": "createConfirmedSchedule",
  "title": "商談",
  "start": "2026/05/10 13:00",
  "durationMinutes": 60,
  "useZoom": true,
  "sourceType": "user",
  "userId": "USER_ID_FROM_LINE"
}
```

## 作成されるシート

- `設定`
- `ルール管理`
- `例外ルール`
- `Zoom管理`
- `ログ`
- `ユーザー管理`
- `提案管理`

## 注意

- `YOUR_SPREADSHEET_ID`、`YOUR_LINE_TOKEN`、`YOUR_GAS_WEB_APP_URL`、`YOUR_MAKE_WEBHOOK_URL` は本物の値に置き換える場所です。
- ただし、Claudeや外部AIに渡すときは本物の値を書かず、ダミーのまま渡してください。
- 既存案件のIDやURLは使い回さないでください。
