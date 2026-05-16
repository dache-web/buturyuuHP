# Step6 リリース前チェックリスト

## セキュリティ

- [ ] Claudeや外部AIに本物の `LINE_TOKEN` を貼っていない
- [ ] Claudeや外部AIに本物の `SS_ID` を貼っていない
- [ ] Make Webhook URLを公開場所に貼っていない
- [ ] GAS WebアプリURLを不必要に公開していない
- [ ] もし本物のLINE_TOKENを外部に貼った場合、LINE Developersで再発行した

## スプレッドシート

- [ ] `設定` シートがある
- [ ] `設定` シートの `カレンダーID` 行にカレンダーIDが入っている
- [ ] `設定` シートの `GAS_WEB_APP_URL` 行にデプロイ後のURLが入っている
- [ ] `設定` シートの `MAKE_WEBHOOK_URL` 行にMake Webhook URLが入っている
- [ ] `ルール管理` シートがある
- [ ] `ルール管理` に営業時間が入っている
- [ ] `例外ルール` シートがある
- [ ] `Zoom管理` シートがある
- [ ] `Zoom管理` に本物のZoom URLが最低1つ入っている
- [ ] `Zoom管理` の有効列がTRUEになっている
- [ ] `提案管理` シートがある
- [ ] `ログ` シートがある
- [ ] `エラー履歴` シートがある

## GAS

- [ ] 既存GASに `既存GAS_追加実装_step1.gs` の内容を追加した
- [ ] 既存 `doPost(e)` にMake API判定を追加した
- [ ] `test_setupAiSecretarySheets()` が成功した
- [ ] `test_getAvailableSlotsForMake()` が成功した
- [ ] `test_getScheduleForMake()` が成功した
- [ ] Webアプリとしてデプロイ済み
- [ ] Webアプリの実行ユーザーが自分になっている
- [ ] Webアプリのアクセス権がMakeから呼べる設定になっている
- [ ] Googleカレンダー権限を許可した
- [ ] Google Meetを使う場合、Calendar APIの高度なGoogleサービスが有効

## Make

- [ ] LINE Webhookを受けるモジュールがある
- [ ] OpenAI分類モジュールがある
- [ ] Parse JSONモジュールがある
- [ ] Routerが5分類に分かれている
- [ ] 調整ルートが `getAvailableSlots` を呼ぶ
- [ ] リスケルートが `getAvailableSlots` を呼ぶ
- [ ] 確認ルートが `getSchedule` を呼ぶ
- [ ] 予定追加ルートが `addManualSchedule` を呼ぶ
- [ ] 確定ルートが `createConfirmedSchedule` を呼ぶ
- [ ] 候補提示時に `proposalId` をData storeへ保存している
- [ ] 確定時にData storeから `proposalId` を取り出している
- [ ] GASの `result.text` をLINE返信に使っている
- [ ] エラー時の返信文がある
- [ ] MakeシナリオがONになっている

## LINE

- [ ] Messaging APIが有効
- [ ] Webhook URLにMake Webhook URLが設定されている
- [ ] Webhook利用がON
- [ ] 応答メッセージがOFF
- [ ] 必要に応じてあいさつメッセージを調整済み
- [ ] リッチメニューが作成済み
- [ ] リッチメニューがスマホに表示される
- [ ] `今日` ボタンで「今日の予定」が送信される
- [ ] `明日` ボタンで「明日の予定」が送信される
- [ ] `1週間` ボタンで「1週間の予定」が送信される

## 動作確認

- [ ] 「今日の予定」で予定が返る
- [ ] 「明日の予定」で予定が返る
- [ ] 「1週間の予定」で予定が返る
- [ ] 「明日の13時に会議を入れて」で予定追加できる
- [ ] 「商談を60分で日程調整したい」で候補が返る
- [ ] 候補提示後、「1番でお願いします」で確定できる
- [ ] 確定時にZoom URLが返る
- [ ] `Zoom管理` の最終使用日時が更新される
- [ ] `提案管理` のステータスが `候補提示` から `確定` になる
- [ ] 「次週でリスケしたい」で来週以降の候補が返る
- [ ] 1対1トークでは転送用の前置きが付く
- [ ] グループでは直接読める文章になる

## リリース判断

以下がすべてOKなら、最低限リリース可能です。

- [ ] 予定確認ができる
- [ ] 予定追加ができる
- [ ] 候補提示ができる
- [ ] 候補番号で確定できる
- [ ] Zoom URLが返る
- [ ] エラー時にMake/GAS/スプレッドシートログで原因を追える
