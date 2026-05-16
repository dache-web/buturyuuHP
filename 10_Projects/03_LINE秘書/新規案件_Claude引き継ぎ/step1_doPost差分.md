# Step1: 既存 doPost への最小差分

## 目的

既存のLINE Webhook処理を壊さず、MakeからGASをHTTP APIとして呼べる入口を追加します。

## 変更する場所

既存GASの `doPost(e)` の中です。

現在は、冒頭がこの形になっています。

```javascript
function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents);
    if (!json.events || json.events.length === 0) return ContentService.createTextOutput("OK");
```

これを、以下のように変更してください。

```javascript
function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents);

    // MakeからのAPI呼び出しの場合だけ、LINE Webhookとは別ルートで処理する
    if (isMakeApiPayload_(json)) return handleMakeApiRequest_(json);

    if (!json.events || json.events.length === 0) return ContentService.createTextOutput("OK");
```

## 変更理由

LINEから来るWebhookは、以下のように `events` を持っています。

```json
{
  "events": []
}
```

MakeからGASをAPIとして呼ぶ場合は、以下のように `action` を持たせます。

```json
{
  "action": "setupAiSecretarySheets"
}
```

この違いで処理を分けるため、既存LINE処理の前に1行だけ判定を追加します。

## 影響

- LINEからの通常メッセージ処理には影響しません
- 既存の予約、予定確認、Meet発行には影響しません
- Makeから `action` 付きJSONをPOSTした場合だけ、新しい処理が動きます

## Step1でMakeからテストするJSON

```json
{
  "action": "health"
}
```

期待結果:

```json
{
  "ok": true,
  "action": "health",
  "result": {
    "message": "GAS API is running."
  }
}
```

不足シート作成:

```json
{
  "action": "setupAiSecretarySheets"
}
```

期待結果:

```json
{
  "ok": true,
  "action": "setupAiSecretarySheets",
  "result": {
    "message": "AI秘書用の不足シートを作成・確認しました。"
  }
}
```

