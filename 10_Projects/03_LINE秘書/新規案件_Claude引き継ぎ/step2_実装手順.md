# Step2 実装手順: 空き時間計算とZoomローテーション

## 今回実装したこと

Step1の追加コード `既存GAS_追加実装_step1.gs` に、以下を追加しました。

1. 空き時間候補の取得
2. 予定前後30分バッファ
3. `ルール管理` の営業時間反映
4. `例外ルール` の空き・ブロック反映
5. `次週` / `来週` 対応
6. `Zoom管理` から一番古いZoom URLを取得し、最終使用日時を更新

既存のLINE予約フロー、予定確認、Google Meet発行は変更しません。

## 追加されたMake API action

### 1. 空き時間候補取得

```json
{
  "action": "getAvailableSlots",
  "slotMinutes": 60,
  "bufferMinutes": 30,
  "maxResults": 5,
  "lookaheadDays": 14,
  "weekOffset": 0,
  "sourceType": "group"
}
```

### 2. 次週の空き時間候補取得

```json
{
  "action": "getAvailableSlots",
  "slotMinutes": 60,
  "bufferMinutes": 30,
  "maxResults": 5,
  "lookaheadDays": 14,
  "weekOffset": 1,
  "sourceType": "group"
}
```

または、文章に `次週` / `来週` が含まれていれば次週扱いになります。

```json
{
  "action": "getAvailableSlots",
  "text": "次週で候補を出して",
  "slotMinutes": 60,
  "maxResults": 5,
  "sourceType": "user"
}
```

### 3. Zoom URLローテーション取得

```json
{
  "action": "getRotatingZoomUrl"
}
```

## 返却例: 空き時間候補

```json
{
  "ok": true,
  "action": "getAvailableSlots",
  "result": {
    "slots": [
      {
        "start": "2026/05/04 09:00",
        "end": "2026/05/04 10:00",
        "label": "05/04(月) 09:00 - 10:00"
      }
    ],
    "text": "候補日時はこちらです。\n1. 05/04(月) 09:00 - 10:00\n\nご都合のよい番号をお知らせください。",
    "weekOffset": 0,
    "slotMinutes": 60,
    "bufferMinutes": 30
  }
}
```

## 返却例: 個人LINE用

`sourceType` に `user` を入れると、転送用の前置きが入ります。

```json
{
  "action": "getAvailableSlots",
  "slotMinutes": 60,
  "maxResults": 3,
  "sourceType": "user"
}
```

返答文:

```text
以下のメッセージを転送してお使いください。

候補日時はこちらです。
1. 05/04(月) 09:00 - 10:00
2. 05/04(月) 10:00 - 11:00

ご都合のよい番号をお知らせください。
```

## 返却例: Zoom URL

```json
{
  "ok": true,
  "action": "getRotatingZoomUrl",
  "result": {
    "zoomNumber": 1,
    "zoomUrl": "https://zoom.us/j/xxxx",
    "usedAt": "2026/05/02 08:00:00"
  }
}
```

## 事前確認

### 設定シート

`設定` シートの `B1` にGoogleカレンダーIDが必要です。

例:

```text
example@gmail.com
```

またはGoogleカレンダーの設定画面にあるカレンダーID。

### ルール管理

営業時間が入っているか確認してください。

| 曜日 | 営業開始 | 営業終了 | 有効 | メモ |
|---|---|---|---|---|
| 月 | 09:00 | 18:00 | TRUE |  |

### 例外ルール

必要に応じて、特別に空ける時間・塞ぐ時間を入れます。

| 日付 | 開始 | 終了 | 種別 | メモ |
|---|---|---|---|---|
| 2026/05/10 | 13:00 | 15:00 | 空き | 臨時対応 |
| 2026/05/11 | 10:00 | 12:00 | ブロック | 外出 |

### Zoom管理

`YOUR_ZOOM_URL_1` のままだと候補から除外されます。
実際に使うZoom URLを入れてください。

| Zoom番号 | Zoom URL | 最終使用日時 | 有効 | メモ |
|---|---|---|---|---|
| 1 | https://zoom.us/j/xxxx |  | TRUE |  |

## GASでの手動テスト

GASエディタで以下を実行します。

```javascript
test_getAvailableSlotsForMake()
```

次にZoom URLを確認します。

```javascript
test_getRotatingZoomUrlForMake()
```

## Makeでのテスト

HTTPモジュールでGAS WebアプリURLへPOSTします。

ヘッダー:

```text
Content-Type: application/json
```

Body:

```json
{
  "action": "getAvailableSlots",
  "slotMinutes": 60,
  "bufferMinutes": 30,
  "maxResults": 5,
  "sourceType": "group"
}
```

## 失敗したときに見る場所

- GAS実行ログ
- スプレッドシートの `ログ`
- スプレッドシートの `エラー履歴`
- `設定` シートB1のカレンダーID
- `ルール管理` の営業時間
- `Zoom管理` のURLが `YOUR_ZOOM_URL_1` のままになっていないか

## 次のStep3でやること

次は以下を追加します。

1. Makeからの手動予定追加API
2. Makeからの予定確認API
3. 確定ルート用に「予定登録 + Zoom取得」をまとめたAPI

