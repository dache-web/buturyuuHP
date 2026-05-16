# Step3 実装手順: 予定確認・手動追加・確定予定作成

## 今回実装したこと

Step1/Step2の追加コード `既存GAS_追加実装_step1.gs` に、Make用APIを3つ追加しました。

1. `getSchedule`
   - 今日、明日、1週間、指定期間の予定を取得
2. `addManualSchedule`
   - Makeで抽出した日時とタイトルで予定を登録
3. `createConfirmedSchedule`
   - 確定予定を登録し、必要に応じてZoom URLをローテーション取得

既存のLINE予約フロー、予定確認、Google Meet発行は変更しません。

## 追加されたMake API action

### 1. 今日の予定確認

```json
{
  "action": "getSchedule",
  "range": "today",
  "sourceType": "group"
}
```

### 2. 明日の予定確認

```json
{
  "action": "getSchedule",
  "range": "tomorrow",
  "sourceType": "group"
}
```

### 3. 1週間の予定確認

```json
{
  "action": "getSchedule",
  "range": "week",
  "sourceType": "group"
}
```

### 4. 指定期間の予定確認

```json
{
  "action": "getSchedule",
  "startDate": "2026/05/10",
  "endDate": "2026/05/12",
  "sourceType": "group"
}
```

## 予定確認の返却例

```json
{
  "ok": true,
  "action": "getSchedule",
  "result": {
    "range": "today",
    "label": "今日の予定",
    "schedules": [
      {
        "title": "会議",
        "start": "2026/05/02 13:00",
        "end": "2026/05/02 14:00",
        "allDay": false,
        "description": ""
      }
    ],
    "text": "[今日の予定]\n\n2026/05/02 13:00 - 2026/05/02 14:00\n会議"
  }
}
```

## 5. 手動予定追加

Makeで「明日の13時に会議を入れて」のような発言から日時とタイトルを抽出したあと、このAPIを呼びます。

```json
{
  "action": "addManualSchedule",
  "title": "会議",
  "start": "2026/05/10 13:00",
  "durationMinutes": 60,
  "description": "Makeから手動追加",
  "sourceType": "group"
}
```

終了日時を直接指定する場合:

```json
{
  "action": "addManualSchedule",
  "title": "会議",
  "start": "2026/05/10 13:00",
  "end": "2026/05/10 14:30",
  "description": "Makeから手動追加",
  "sourceType": "group"
}
```

返却文:

```text
予定を登録しました。
件名: 会議
日時: 2026/05/10 13:00 - 14:00
```

## 6. 確定予定作成 + Zoom URL取得

日程調整後、ユーザーが候補を確定したときに使います。

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

返却文:

```text
日程が確定しました。
件名: 商談
日時: 2026/05/10 13:00 - 14:00
Zoom: https://zoom.us/j/xxxx
```

## 個人LINE用の前置き

`sourceType` に `user` を入れると、転送用の前置きが付きます。

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

返却文:

```text
以下のメッセージを転送してお使いください。

日程が確定しました。
件名: 商談
日時: 2026/05/10 13:00 - 14:00
Zoom: https://zoom.us/j/xxxx
```

## 事前確認

### 設定シート

`設定` シートの `カレンダーID` 行にGoogleカレンダーIDが入っている必要があります。

### Zoom管理

`createConfirmedSchedule` で `useZoom: true` にする場合、`Zoom管理` に実際のZoom URLが必要です。

`YOUR_ZOOM_URL_1` のままだと候補から除外されます。

### 提案管理

`createConfirmedSchedule` を呼ぶと、`提案管理` に確定履歴が追記されます。

## GASでの手動テスト

予定確認:

```javascript
test_getScheduleForMake()
```

手動予定追加:

```javascript
test_addManualScheduleForMake()
```

注意:

`test_addManualScheduleForMake()` は実際に明日の13時へ「テスト予定」を登録します。
不要ならテスト後にGoogleカレンダーから削除してください。

## Makeでのテスト

HTTPモジュールでGAS WebアプリURLへPOSTします。

ヘッダー:

```text
Content-Type: application/json
```

Body:

```json
{
  "action": "getSchedule",
  "range": "today",
  "sourceType": "group"
}
```

## Make Routerとの対応

| AI分類 | GAS action |
|---|---|
| 確認 | getSchedule |
| 予定追加 | addManualSchedule |
| 確定 | createConfirmedSchedule |
| 調整 | getAvailableSlots |
| リスケ | getAvailableSlots |

## 失敗したときに見る場所

- GAS実行ログ
- スプレッドシートの `ログ`
- スプレッドシートの `エラー履歴`
- Make HTTPモジュールのレスポンス
- `設定` シートの `カレンダーID`
- `Zoom管理` のZoom URL

## 次のStep4でやること

次はMake側の設計に進みます。

1. OpenAI分類プロンプト
2. Router分岐条件
3. LINE個人/グループ判定
4. 各ルートで送るHTTP Body
