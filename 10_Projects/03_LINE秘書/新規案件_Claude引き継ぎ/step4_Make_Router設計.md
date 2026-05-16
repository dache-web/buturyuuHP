# Step4 Make Router設計

## 全体の流れ

Makeシナリオは以下の順番で作ります。

1. LINE Webhook受信
2. LINEイベントから本文・送信元種別を取得
3. OpenAIで発言分類
4. Parse JSON
5. Routerで5つに分岐
6. GAS WebアプリURLへHTTP POST
7. GASの返却 `result.text` をLINEへ返信

## LINE送信元種別

LINEイベントの `source.type` を使います。

| source.type | 意味 | GASへ渡す sourceType |
|---|---|---|
| user | 1対1トーク | user |
| group | グループ | group |
| room | 複数人トーク | room |

## Router 1: 調整

### 条件

```text
intent = 調整
```

### 呼ぶGAS action

```text
getAvailableSlots
```

### 目的

営業時間・例外ルール・既存予定・前後30分バッファを見て、候補日時を返します。

## Router 2: 確定

### 条件

```text
intent = 確定
```

### 呼ぶGAS action

```text
createConfirmedSchedule
```

### 目的

選ばれた候補日時をGoogleカレンダーに登録し、Zoom URLを取得して返信します。

注意:

- 候補番号だけ来る場合、Make側で前回候補をData storeなどに保存しておく必要があります。
- 候補提示時にGASが返す `proposalId` をData storeへ保存し、確定時に `proposalId` と `candidateNumber` を渡してください。

## Router 3: リスケ

### 条件

```text
intent = リスケ
```

### 呼ぶGAS action

```text
getAvailableSlots
```

### 目的

再調整用の候補日時を返します。

`次週` または `来週` の場合:

```text
weekOffset = 1
```

## Router 4: 確認

### 条件

```text
intent = 確認
```

### 呼ぶGAS action

```text
getSchedule
```

### 目的

今日・明日・1週間の予定を取得して返信します。

## Router 5: 予定追加

### 条件

```text
intent = 予定追加
```

### 呼ぶGAS action

```text
addManualSchedule
```

### 目的

ユーザー発言から抽出した日時とタイトルでGoogleカレンダーに予定を登録します。

## Router 6: 不明

### 条件

```text
intent = 不明
```

または、intentが空の場合。

### LINE返信

```text
すみません、内容をうまく判定できませんでした。
「今日の予定」「明日の13時に会議を追加」「来週で日程調整」のように送ってください。
```

## Router対応表

| intent | GAS action | LINE返信に使う値 |
|---|---|---|
| 調整 | getAvailableSlots | result.text |
| 確定 | createConfirmedSchedule | result.text |
| リスケ | getAvailableSlots | result.text |
| 確認 | getSchedule | result.text |
| 予定追加 | addManualSchedule | result.text |
| 不明 | なし | 固定メッセージ |

## Makeで保存した方がよい情報

確定ルートを自然に動かすには、候補提示時に候補一覧を保存しておく必要があります。

保存先候補:

- Make Data store
- Googleスプレッドシートの `提案管理`

保存する内容:

| キー | 内容 |
|---|---|
| userId または groupId | 誰の候補か |
| proposalId | GASから返った提案ID |
| title | 件名 |
| durationMinutes | 所要時間 |
| createdAt | 作成日時 |

候補一覧そのものはGASの `提案管理` シートにも保存されます。
