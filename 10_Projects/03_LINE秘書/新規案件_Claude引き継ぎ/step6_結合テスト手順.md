# Step6 結合テスト手順

## 目的

GAS、スプレッドシート、Make、LINEが正しくつながっているか確認します。

テストは以下の順番で行います。

1. スプレッドシート確認
2. GAS単体テスト
3. MakeからGASを呼ぶテスト
4. LINEからMakeを呼ぶテスト
5. 全ルートの動作確認

## 1. スプレッドシート確認

既存スプレッドシートに以下があるか確認します。

- `設定`
- `ログ`
- `エラー履歴`
- `ユーザー管理`
- `ルール管理`
- `例外ルール`
- `Zoom管理`
- `提案管理`

### 設定シート

`設定` シートの `カレンダーID` 行の値にGoogleカレンダーIDが入っていること。

```text
example@gmail.com
```

またはGoogleカレンダー設定画面のカレンダーID。

### Zoom管理

`YOUR_ZOOM_URL_1` のままだとZoom取得対象から外れます。

最低1つは本物のZoom URLにしてください。

## 2. GAS単体テスト

GASエディタで以下を実行します。

### 不足シート作成

```javascript
test_setupAiSecretarySheets()
```

### 空き時間候補

```javascript
test_getAvailableSlotsForMake()
```

### Zoom URL取得

```javascript
test_getRotatingZoomUrlForMake()
```

### 予定確認

```javascript
test_getScheduleForMake()
```

注意:

```javascript
test_addManualScheduleForMake()
```

これは実際にGoogleカレンダーへ予定を作ります。使う場合は、テスト後にカレンダーから削除してください。

## 3. MakeからGASを呼ぶテスト

MakeのHTTPモジュールでGAS WebアプリURLへPOSTします。

Header:

```text
Content-Type: application/json
```

### health

```json
{
  "action": "health"
}
```

成功条件:

```json
"ok": true
```

### 空き時間候補

```json
{
  "action": "getAvailableSlots",
  "title": "テスト商談",
  "slotMinutes": 60,
  "bufferMinutes": 30,
  "maxResults": 3,
  "sourceType": "group",
  "userId": "TEST_USER"
}
```

成功条件:

- `result.proposalId` が返る
- `result.slots` が返る
- `提案管理` に候補が保存される

### 候補番号で確定

上で返った `proposalId` を使います。

```json
{
  "action": "createConfirmedSchedule",
  "proposalId": "ここにproposalId",
  "candidateNumber": 1,
  "title": "テスト商談",
  "durationMinutes": 60,
  "useZoom": true,
  "sourceType": "group",
  "userId": "TEST_USER"
}
```

成功条件:

- Googleカレンダーに予定が作られる
- `Zoom管理` の最終使用日時が更新される
- `提案管理` のステータスが `確定` になる

## 4. LINEからMakeを呼ぶテスト

スマホのLINEから以下を送ります。

```text
今日の予定
```

成功条件:

- MakeのWebhookが動く
- OpenAI分類が `確認` になる
- Routerで確認ルートを通る
- GAS `getSchedule` が呼ばれる
- LINEに予定一覧が返る

## 5. 全ルートの動作確認

### 確認ルート

送信:

```text
今日の予定
```

期待:

```text
[今日の予定]

予定一覧
```

### 予定追加ルート

送信:

```text
明日の13時に会議を入れて
```

期待:

- Googleカレンダーに予定が入る
- LINEに登録完了メッセージが返る

### 調整ルート

送信:

```text
商談を60分で日程調整したい
```

期待:

- 候補日時が返る
- `提案管理` に候補が保存される

### 確定ルート

送信:

```text
1番でお願いします
```

期待:

- 直前の候補1番でGoogleカレンダーに予定が入る
- Zoom URLが返信される
- `提案管理` のステータスが `確定` になる

### リスケルート

送信:

```text
次週でリスケしたい
```

期待:

- 来週以降の候補が返る

## エラー時の切り分け

### LINEに何も返らない

見る場所:

- LINE Webhook URL
- Make Webhook受信履歴
- MakeシナリオがONか

### Makeは動くがGASが失敗する

見る場所:

- HTTPモジュールのレスポンス
- GASの `ログ`
- GASの `エラー履歴`

### GASは成功するが予定が入らない

見る場所:

- `設定` シートの `カレンダーID`
- Apps Scriptの権限
- Googleカレンダーへのアクセス権

### Zoom URLが返らない

見る場所:

- `Zoom管理` のURL
- `有効` がTRUEか
- `YOUR_ZOOM_URL_1` のままになっていないか

### 1番で確定できない

見る場所:

- Make Data storeに直前の `proposalId` が保存されているか
- `提案管理` に該当 `proposalId` があるか
- OpenAI分類で `candidateNumber` が取れているか
