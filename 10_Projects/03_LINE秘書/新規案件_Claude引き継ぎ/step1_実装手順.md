# Step1 実装手順: 不足シート作成とMake API入口

## 今回実装すること

今回は2つだけ実装します。

1. 既存スプレッドシートに不足シートを作る
2. MakeからGASを呼べる入口を作る

既存の予約機能、予定確認、Google Meet発行、ログ機能は変更しません。

## 追加するファイル

GASに新しいファイルを1つ追加し、以下の内容を貼り付けます。

```text
既存GAS_追加実装_step1.gs
```

このファイルには以下が入っています。

- `isMakeApiPayload_(json)`
- `handleMakeApiRequest_(payload)`
- `setupAiSecretarySheets()`
- `test_setupAiSecretarySheets()`

## 既存コードで変更する場所

既存の `doPost(e)` に、以下の3行だけ追加します。

```javascript
// MakeからのAPI呼び出しの場合だけ、LINE Webhookとは別ルートで処理する
if (isMakeApiPayload_(json)) return handleMakeApiRequest_(json);
```

貼る場所は `step1_doPost差分.md` を見てください。

## 作成されるシート

既存スプレッドシートに、なければ以下を作成します。

### ルール管理

| 曜日 | 営業開始 | 営業終了 | 有効 | メモ |
|---|---|---|---|---|

### 例外ルール

| 日付 | 開始 | 終了 | 種別 | メモ |
|---|---|---|---|---|

### Zoom管理

| Zoom番号 | Zoom URL | 最終使用日時 | 有効 | メモ |
|---|---|---|---|---|

### 提案管理

| 提案ID | userId | 件名 | 候補日時 | ステータス | Zoom URL | 作成日時 | 更新日時 |
|---|---|---|---|---|---|---|---|

## GAS上での確認

1. GASに `既存GAS_追加実装_step1.gs` の内容を追加します。
2. 既存 `doPost(e)` に最小差分を入れます。
3. `test_setupAiSecretarySheets()` を実行します。
4. 権限確認が出たら許可します。
5. スプレッドシートに以下のシートができているか確認します。

- `ルール管理`
- `例外ルール`
- `Zoom管理`
- `提案管理`

## Makeからの確認

HTTPモジュールで、GAS WebアプリURLへPOSTします。

ヘッダー:

```text
Content-Type: application/json
```

Body:

```json
{
  "action": "health"
}
```

成功すると `ok: true` が返ります。

次に以下を送ります。

```json
{
  "action": "setupAiSecretarySheets"
}
```

成功すると不足シートが作成されます。

## 失敗したときに見る場所

- GASの実行ログ
- スプレッドシートの `ログ` シート
- スプレッドシートの `エラー履歴` シート
- MakeのHTTPモジュールのレスポンス本文

## 次のStep2でやること

次は以下を追加します。

1. `ルール管理` と `例外ルール` を使った空き時間候補計算
2. 予定前後30分バッファ
3. `Zoom管理` から一番古いZoom URLを取得するローテーション

