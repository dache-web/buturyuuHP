# Step4 Make HTTP Body集

## 共通設定

MakeのHTTPモジュールで、GAS WebアプリURLへPOSTします。

URL:

```text
YOUR_GAS_WEB_APP_URL
```

Method:

```text
POST
```

Headers:

```text
Content-Type: application/json
```

Body type:

```text
Raw
```

Content type:

```text
JSON
```

## 共通で渡す sourceType

LINEイベントの `source.type` を渡します。

```json
"sourceType": "{{LINE source.type}}"
```

値は以下のどれかです。

- `user`
- `group`
- `room`

## 1. 調整ルート

intent:

```text
調整
```

GAS action:

```text
getAvailableSlots
```

HTTP Body:

```json
{
  "action": "getAvailableSlots",
  "title": "{{ifempty(OpenAI.title; \"予定\")}}",
  "slotMinutes": {{OpenAI.durationMinutes}},
  "bufferMinutes": 30,
  "maxResults": 5,
  "lookaheadDays": 14,
  "weekOffset": {{OpenAI.weekOffset}},
  "text": "{{LINE message.text}}",
  "sourceType": "{{LINE source.type}}",
  "userId": "{{LINE source.userId}}"
}
```

補足:

- `durationMinutes` が空の場合は `60` を入れてください。
- Make側で `ifempty(OpenAI.durationMinutes; 60)` のように補正すると安全です。

## 2. リスケルート

intent:

```text
リスケ
```

GAS action:

```text
getAvailableSlots
```

HTTP Body:

```json
{
  "action": "getAvailableSlots",
  "title": "{{ifempty(OpenAI.title; \"リスケ\")}}",
  "slotMinutes": {{ifempty(OpenAI.durationMinutes; 60)}},
  "bufferMinutes": 30,
  "maxResults": 5,
  "lookaheadDays": 14,
  "weekOffset": {{OpenAI.weekOffset}},
  "text": "{{LINE message.text}}",
  "sourceType": "{{LINE source.type}}",
  "userId": "{{LINE source.userId}}"
}
```

補足:

- 「次週」「来週」が含まれる場合は `weekOffset` が `1` になります。
- GAS側でも `text` に次週/来週が含まれていれば次週扱いにします。

## 3. 確認ルート

intent:

```text
確認
```

GAS action:

```text
getSchedule
```

HTTP Body:

```json
{
  "action": "getSchedule",
  "range": "{{OpenAI.range}}",
  "sourceType": "{{LINE source.type}}"
}
```

rangeの値:

| ユーザー発言 | range |
|---|---|
| 今日の予定 | today |
| 明日の予定 | tomorrow |
| 1週間の予定 | week |

## 4. 予定追加ルート

intent:

```text
予定追加
```

GAS action:

```text
addManualSchedule
```

HTTP Body:

```json
{
  "action": "addManualSchedule",
  "title": "{{OpenAI.title}}",
  "start": "{{OpenAI.start}}",
  "end": "{{OpenAI.end}}",
  "durationMinutes": {{ifempty(OpenAI.durationMinutes; 60)}},
  "description": "Makeから手動追加",
  "sourceType": "{{LINE source.type}}"
}
```

注意:

- `start` が空の場合、このAPIは失敗します。
- OpenAIだけで日時を確定できない場合は、Make側でユーザーに「日時をもう少し詳しく教えてください」と返してください。

## 5. 確定ルート

intent:

```text
確定
```

GAS action:

```text
createConfirmedSchedule
```

候補日時を直接持っている場合のHTTP Body:

```json
{
  "action": "createConfirmedSchedule",
  "title": "{{OpenAI.title}}",
  "start": "{{OpenAI.start}}",
  "end": "{{OpenAI.end}}",
  "durationMinutes": {{ifempty(OpenAI.durationMinutes; 60)}},
  "useZoom": true,
  "sourceType": "{{LINE source.type}}",
  "userId": "{{LINE source.userId}}"
}
```

候補番号だけの場合:

```json
{
  "action": "createConfirmedSchedule",
  "proposalId": "{{DataStore.proposalId}}",
  "candidateNumber": {{OpenAI.candidateNumber}},
  "title": "{{DataStore.title}}",
  "durationMinutes": "{{DataStore.durationMinutes}}",
  "useZoom": true,
  "sourceType": "{{LINE source.type}}",
  "userId": "{{LINE source.userId}}"
}
```

注意:

- ユーザーが「1番」と言った場合、`candidateNumber` は `1` のままGASへ渡します。
- GAS側が `提案管理` の候補JSONを読み、内部で `candidateNumber - 1` として参照します。
- 候補提示ルートの後、Make Data storeに `proposalId`、`title`、`durationMinutes` を保存してください。

## 6. GASレスポンス後のLINE返信

GASの返却JSONから以下をLINEに送ります。

```text
{{GAS.result.text}}
```

GASエラー時:

```text
処理中にエラーが発生しました。設定を確認します。
```

Makeの実行履歴では、GASレスポンスの `error` を確認してください。
