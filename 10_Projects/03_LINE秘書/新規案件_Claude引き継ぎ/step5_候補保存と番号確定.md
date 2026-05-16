# Step5 候補保存と番号確定

## 今回実装したこと

ユーザーに候補日時を提示したあと、ユーザーが「1番でお願いします」のように返したときに、その候補番号から予定を確定できるようにしました。

## 追加された仕組み

### 1. 候補提示時

Makeが以下を呼びます。

```json
{
  "action": "getAvailableSlots",
  "title": "商談",
  "slotMinutes": 60,
  "bufferMinutes": 30,
  "maxResults": 5,
  "sourceType": "group",
  "userId": "USER_ID_FROM_LINE"
}
```

GASは以下を行います。

- 空き時間候補を計算
- `proposalId` を発行
- `提案管理` シートへ候補一覧を保存
- LINE返信用の `result.text` に提案IDを含める

返却例:

```json
{
  "ok": true,
  "action": "getAvailableSlots",
  "result": {
    "proposalId": "P20260502083000-abc12345",
    "slots": [
      {
        "start": "2026/05/04 09:00",
        "end": "2026/05/04 10:00",
        "label": "05/04(月) 09:00 - 10:00"
      }
    ],
    "text": "候補日時はこちらです。\n提案ID: P20260502083000-abc12345\n1. 05/04(月) 09:00 - 10:00\n\nご都合のよい番号をお知らせください。"
  }
}
```

## 2. 候補番号で確定

ユーザーが「1番で」と送ったら、MakeはOpenAI分類で以下を作ります。

```json
{
  "intent": "確定",
  "candidateNumber": 1
}
```

Makeは、前回の `proposalId` と `candidateNumber` をGASへ渡します。

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

GASは以下を行います。

- `提案管理` から `proposalId` の候補一覧を探す
- `candidateNumber` に対応する候補日時を取り出す
- Googleカレンダーに予定を登録
- `Zoom管理` からZoom URLを取得
- `提案管理` のステータスを `確定` に更新
- LINE返信用の `result.text` を返す

返却例:

```text
日程が確定しました。
件名: 商談
日時: 2026/05/04 09:00 - 10:00
Zoom: https://zoom.us/j/xxxx
```

## 提案管理シートの使い方

候補提示時は以下のように保存されます。

| 列 | 内容 |
|---|---|
| 提案ID | `P20260502083000-abc12345` |
| userId | LINEのuserId |
| 件名 | 商談 |
| 候補日時 | 候補一覧JSON |
| ステータス | 候補提示 |
| Zoom URL | 空 |
| 作成日時 | 作成日時 |
| 更新日時 | 更新日時 |

確定後:

| 列 | 内容 |
|---|---|
| ステータス | 確定 |
| Zoom URL | 使用したZoom URL |
| 更新日時 | 確定日時 |

## Makeで必要な保存

確実に動かすには、Make側でも直近の `proposalId` を保存してください。

保存先候補:

- Make Data store
- もしくはLINE返信文に含まれる提案IDをユーザーに見せて、そのIDを使う

おすすめはMake Data storeです。

### Data storeのキー

1対1トーク:

```text
{{LINE source.userId}}
```

グループ:

```text
{{LINE source.groupId}}
```

room:

```text
{{LINE source.roomId}}
```

### 保存する値

```json
{
  "proposalId": "{{GAS.result.proposalId}}",
  "title": "{{OpenAI.title}}",
  "durationMinutes": "{{OpenAI.durationMinutes}}",
  "createdAt": "{{now}}"
}
```

## 確定ルートのHTTP Body

Make Data storeから `proposalId` を取り出して、以下を送ります。

```json
{
  "action": "createConfirmedSchedule",
  "proposalId": "{{DataStore.proposalId}}",
  "candidateNumber": {{OpenAI.candidateNumber}},
  "title": "{{DataStore.title}}",
  "durationMinutes": {{ifempty(DataStore.durationMinutes; 60)}},
  "useZoom": true,
  "sourceType": "{{LINE source.type}}",
  "userId": "{{LINE source.userId}}"
}
```

## 注意点

- ユーザーが「1番」と言った場合、`candidateNumber` は `1` のままGASへ渡してください。
- GAS側で `candidateNumber - 1` として候補配列を参照します。
- proposalIdが見つからない場合は、もう一度候補提示からやり直してください。

## エラー時のLINE返信

proposalIdがない場合:

```text
直前の候補が見つかりませんでした。
もう一度、日程調整からお願いします。
```

candidateNumberがない場合:

```text
何番の候補にするか教えてください。
例: 1番でお願いします
```

## 次のStep6でやること

次はLINEリッチメニューと、Makeの最終確認チェックリストを作ります。

