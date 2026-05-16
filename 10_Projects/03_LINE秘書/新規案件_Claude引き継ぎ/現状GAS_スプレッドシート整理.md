# 現状GAS・スプレッドシート構成整理

## 方針変更

当初は完全新規案件として設計していたが、実際には途中まで使っていたスプレッドシートを継続利用する。

そのため、以下の方針で進める。

- スプレッドシートは既存のものを使う
- 既存の `設定`、`ログ`、`ユーザー推移` などの構成を尊重する
- 既存のカレンダー同期、予定確認、予約登録の流れは壊さない
- 足りない機能だけを追加する
- 既存コード全体の置き換えはしない
- LINEトークン、スプレッドシートIDなどの本物の値は外部共有しない

## 現在のGAS概要

コード名の想定:

```text
LINEスケジュール：最終完成版 Ver 3.2
```

現在できていること:

- LINE Webhookを `doPost(e)` で受信
- 友だち追加、ブロック解除の記録
- かんたん予約
- こだわり予約
- Googleカレンダーへの予定登録
- Google Meet発行
- 今日、明日、1週間の予定確認
- お問い合わせURLの表示
- ログ記録
- エラー履歴の分離
- ログの自動ローテーション
- ユーザー状態をPropertiesServiceで保持
- 予定重複時の確認
- 管理者コマンド `!システムログ削除`

## 現在の重要設定

実コードには本物の値が入っているため、外部共有時は必ず伏せる。

```javascript
const LINE_TOKEN = 'YOUR_LINE_TOKEN';
const SS_ID = 'YOUR_SPREADSHEET_ID';
const TEST_MODE = true;
const LOG_MAX_ROWS = 5000;
const LOG_TRIM_COUNT = 500;
```

注意:

- LINE_TOKENは実コードに直書きされている
- SS_IDも実コードに直書きされている
- Claudeや外部AIに渡す場合は必ずダミー化する
- もし本物のLINE_TOKENを外部に貼った場合は、LINE Developersで再発行するのが安全

## 現在使っているスプレッドシート

コード上は `SS_ID` で指定された既存スプレッドシートを使っている。

このスプレッドシートは今後も継続利用する。

## 現在想定されるシート構成

### 設定

現在のGASが参照しているシート。

| セル | 用途 |
|---|---|
| B1 | GoogleカレンダーID |
| B2 | お問い合わせURL |

現在のコード:

```javascript
function getCalendarId(ss) {
  const sheet = ss.getSheetByName('設定');
  if (sheet) {
    const val = sheet.getRange('B1').getValue().toString();
    if (val.includes('@')) return val;
  }
  return "";
}
```

```javascript
function getInquiryUrl(ss) {
  const sheet = ss.getSheetByName('設定');
  if (sheet) {
    const val = sheet.getRange('B2').getValue().toString();
    if (val.startsWith('http')) return val;
  }
  return "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform";
}
```

注意:

- B1が空、または `@` を含まない場合、カレンダーIDは空文字になる
- この場合、CalendarApp.getCalendarById(calendarId) が失敗する可能性がある
- 継続利用するなら、B1にカレンダーIDが正しく入っているか確認が必要

### ログ

`writeLog()` が自動作成または追記する。

列構成:

| A列 | B列 | C列 |
|---|---|---|
| 日時 | 種類 | 内容 |

現在の仕様:

- 最大5000行
- 5000行を超えたら先頭から500行削除
- 削除後にシステムログを追記

### エラー履歴

エラー系ログが出たときだけ自動作成される。

列構成:

| A列 | B列 | C列 |
|---|---|---|
| 日時 | 区分 | 内容 |

対象:

- タグに `エラー` を含む
- タグに `失敗` を含む
- タグに `致命的` を含む

### ユーザー推移

友だち追加、ブロック解除を記録する。

列構成:

| A列 | B列 | C列 |
|---|---|---|
| 日付 | ラインID | ステータス |

ステータス例:

- 有効
- 解除

## 現在のLINE処理フロー

### 1. Webhook受信

入口:

```javascript
function doPost(e)
```

処理:

- LINEイベントをJSONとして読み取り
- イベントがなければOKを返す
- 受信ログを記録
- userId、replyTokenを取得
- followならユーザー推移に `有効` を記録
- unfollowならユーザー推移に `解除` を記録
- 通常メッセージ、postbackは `dispatchAction()` に渡す

### 2. 通常メッセージ処理

入口:

```javascript
function dispatchAction(event, userId, replyToken, userInfo, writeLog)
```

対応メッセージ:

| ユーザー発言 | 処理 |
|---|---|
| かんたん予約 | 日時選択を開始 |
| こだわり予約 | 日時選択を開始し、Meet発行確認あり |
| 今日 | 今日の予定確認 |
| 明日 | 明日の予定確認 |
| 1週間 / １週間 / 一週間 | 1週間の予定確認 |
| お問い合わせ | 問い合わせURL表示 |
| !システムログ削除 | ログ削除 |
| その他 | 案内メッセージ |

### 3. 予約登録フロー

現在の流れ:

1. `かんたん予約` または `こだわり予約`
2. `sendMonthSelectionFlex()` で日時選択
3. LINE datetimepickerで日時選択
4. `handleDateSelection()` で重複確認
5. タイトル入力待ち
6. `sendDurationPicker()` で所要時間選択
7. `finalizeRegistration()` でGoogleカレンダー登録
8. 必要に応じてGoogle Meetを発行

### 4. 予定確認フロー

入口:

```javascript
function getSchedule(range, userInfo)
```

対応範囲:

- today
- tomorrow
- week

返答例:

```text
[今日の予定]

【05/02 (土) 13:00】
会議
```

## 現在のカレンダー連携

カレンダーIDは `設定` シートの `B1` から取得。

予定登録:

```javascript
CalendarApp.getCalendarById(calendarId).createEvent(title, start, end);
```

終日予定:

```javascript
CalendarApp.getCalendarById(calendarId).createAllDayEvent(title, start);
```

予定確認:

```javascript
CalendarApp.getCalendarById(calendarId).getEvents(start, end);
```

Google Meet発行:

```javascript
Calendar.Events.insert(eventJson, calendarId, { conferenceDataVersion: 1 })
```

注意:

- Google Meet発行にはApps Scriptの高度なGoogleサービス `Calendar API` の有効化が必要
- Google Cloud側でもCalendar APIが有効になっている必要がある

## 現在のユーザー状態管理

PropertiesServiceを使用。

保存例:

```javascript
{
  "isDetailed": "true",
  "status": "WAIT_FOR_TITLE",
  "meet": "yes",
  "date": "2026-05-02T13:00",
  "duration": "01:00",
  "title": "会議"
}
```

関数:

- `updateStatus(userId, updates, writeLog)`
- `getStatus(userId)`
- `clearStatus(userId)`

## 既に完成度が高い部分

- LINE Webhook受信
- LINE reply / push
- Googleカレンダー登録
- 今日、明日、1週間の予定確認
- 重複チェック
- 所要時間指定
- 終日予定
- Google Meet発行
- ログ記録
- エラー分離
- ユーザー増減記録

## まだ足りない機能

今回のAI秘書化に向けて足りないもの。

### 1. Makeから呼び出せるAPI形式

現在の `doPost(e)` はLINE Webhook専用。

MakeからHTTPで以下を呼ぶAPIにはなっていない。

- 空き時間候補取得
- Zoom URL取得
- 予定追加
- 予定確認
- リスケ候補取得

追加方針:

- 既存のLINE Webhook処理は壊さない
- `doPost(e)` の中で、LINEイベント形式かMake API形式かを判定する
- Make API形式の場合だけ `action` で分岐する

### 2. 空き時間候補の計算

現在は、選ばれた日時に予定があるかだけを見ている。

足りないもの:

- 営業時間に基づく候補作成
- 予定前後30分バッファ
- 例外的な空き時間
- 例外的なブロック時間
- 次週指定

追加シート候補:

- `ルール管理`
- `例外ルール`

### 3. Zoom URLローテーション

現在はGoogle Meet発行はあるが、Zoom URLを5本ローテーションで使う仕組みはない。

追加シート候補:

- `Zoom管理`

列候補:

| Zoom番号 | Zoom URL | 最終使用日時 | 有効 | メモ |
|---|---|---|---|---|

### 4. リスケ自動化

現在は予約登録と重複確認はあるが、AI分類によるリスケ処理はない。

足りないもの:

- `リスケ` intentの受け口
- 次週や別日条件の反映
- 候補再提示

### 5. AI分類

現在のGASはキーワード判定。

Make側でOpenAI分類を使う場合、以下の分類が必要。

- 調整
- 確定
- リスケ
- 確認
- 予定追加

### 6. 個人LINE / グループLINEの出し分け

現在のコードは主に `event.source.userId` 前提。

足りないもの:

- `event.source.type` の確認
- `user` / `group` / `room` の出し分け
- 個人LINEでは「以下のメッセージを転送してお使いください」
- グループでは直接話しかける文章

## 追加すべきシート

既存スプレッドシートに追加する候補。

### ルール管理

| 曜日 | 営業開始 | 営業終了 | 有効 | メモ |
|---|---|---|---|---|
| 月 | 09:00 | 18:00 | TRUE |  |
| 火 | 09:00 | 18:00 | TRUE |  |
| 水 | 09:00 | 18:00 | TRUE |  |
| 木 | 09:00 | 18:00 | TRUE |  |
| 金 | 09:00 | 18:00 | TRUE |  |
| 土 |  |  | FALSE |  |
| 日 |  |  | FALSE |  |

### 例外ルール

| 日付 | 開始 | 終了 | 種別 | メモ |
|---|---|---|---|---|
| 2026/05/10 | 13:00 | 15:00 | 空き | 臨時対応 |
| 2026/05/11 | 10:00 | 12:00 | ブロック | 外出 |

### Zoom管理

| Zoom番号 | Zoom URL | 最終使用日時 | 有効 | メモ |
|---|---|---|---|---|
| 1 | YOUR_ZOOM_URL_1 |  | TRUE |  |
| 2 | YOUR_ZOOM_URL_2 |  | TRUE |  |
| 3 | YOUR_ZOOM_URL_3 |  | TRUE |  |
| 4 | YOUR_ZOOM_URL_4 |  | TRUE |  |
| 5 | YOUR_ZOOM_URL_5 |  | TRUE |  |

### 提案管理

| 提案ID | userId | 件名 | 候補日時 | ステータス | Zoom URL | 作成日時 | 更新日時 |
|---|---|---|---|---|---|---|---|

## 次にやるべき実装方針

既存コードを壊さずに進めるため、以下の順番が安全。

1. 既存コードの `doPost(e)` にMake API判定を追加
2. `setupAdditionalSheets()` を追加して不足シートだけ作成
3. 空き時間計算関数を追加
4. Zoom URLローテーション関数を追加
5. Make用の `handleMakeApi(payload)` を追加
6. 個人/グループ出し分け用の補助関数を追加
7. Make側でAI分類とRouterを構築
8. LINEリッチメニューを設定

## 既存コードを変更するときの厳守ルール

- 指示された箇所以外は変更しない
- 既存の予約フローは消さない
- 既存の予定確認は消さない
- 既存のログ機能は消さない
- `doPost(e)` は丸ごと置き換えず、Make API判定だけを追加する
- 本物のLINE_TOKENやSS_IDは外部共有しない
- 変更前に「どこを / なぜ / どう変えるか / 影響」を説明する

