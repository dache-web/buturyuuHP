# Step4 Make OpenAI分類プロンプト

## 目的

LINEで届いたユーザー発言を、MakeのRouterで分岐しやすいJSONに分類します。

分類は以下の5つです。

- 調整
- 確定
- リスケ
- 確認
- 予定追加

## System Prompt

MakeのOpenAIモジュールのSystem欄に入れます。

```text
あなたはLINEで使うAI秘書です。
ユーザーの発言を読み取り、予定調整に必要な情報をJSONだけで返してください。

重要ルール:
- 返答は必ずJSONだけにしてください。
- Markdown、説明文、コードブロックは使わないでください。
- 誇張表現や大げさな表現は避けてください。
- 宇宙、革命、魔法のような飛躍した表現は使わないでください。
- 現実的で自然な秘書の口調にしてください。
- わからない項目は空文字 "" または null にしてください。
- 日付が相対表現の場合は、Make側の日付処理に渡しやすいように originalDateText に元の表現を入れてください。
- 「次週」「来週」が含まれる場合は weekOffset を 1 にしてください。
- 「今日」「明日」「1週間」の予定確認は intent を "確認" にしてください。
- 「明日の13時に会議を入れて」のような予定登録依頼は intent を "予定追加" にしてください。
- 「この日で確定」「1番でお願いします」のような候補確定は intent を "確定" にしてください。
- 「別日がいい」「リスケ」「次週で再調整」は intent を "リスケ" にしてください。
- 日程候補を出してほしい依頼は intent を "調整" にしてください。
```

## User Prompt Template

MakeのUser欄に入れます。

```text
以下のLINEメッセージを分類してください。

現在日時:
{{formatDate(now; "YYYY/MM/DD HH:mm"; "Asia/Tokyo")}}

LINE送信元種別:
{{source.type}}

ユーザー発言:
{{message.text}}

返すJSON形式:
{
  "intent": "調整 | 確定 | リスケ | 確認 | 予定追加 | 不明",
  "range": "today | tomorrow | week | custom |",
  "title": "",
  "date": "",
  "start": "",
  "end": "",
  "durationMinutes": null,
  "candidateNumber": null,
  "weekOffset": 0,
  "originalDateText": "",
  "sourceType": "user | group | room",
  "replyText": ""
}
```

## 返却例

### 今日の予定確認

ユーザー発言:

```text
今日の予定教えて
```

返却:

```json
{
  "intent": "確認",
  "range": "today",
  "title": "",
  "date": "",
  "start": "",
  "end": "",
  "durationMinutes": null,
  "candidateNumber": null,
  "weekOffset": 0,
  "originalDateText": "今日",
  "sourceType": "user",
  "replyText": ""
}
```

### 1週間の予定確認

```json
{
  "intent": "確認",
  "range": "week",
  "title": "",
  "date": "",
  "start": "",
  "end": "",
  "durationMinutes": null,
  "candidateNumber": null,
  "weekOffset": 0,
  "originalDateText": "1週間",
  "sourceType": "user",
  "replyText": ""
}
```

### 予定追加

ユーザー発言:

```text
明日の13時に会議を入れて
```

返却:

```json
{
  "intent": "予定追加",
  "range": "",
  "title": "会議",
  "date": "",
  "start": "",
  "end": "",
  "durationMinutes": 60,
  "candidateNumber": null,
  "weekOffset": 0,
  "originalDateText": "明日の13時",
  "sourceType": "user",
  "replyText": ""
}
```

### 日程調整

```json
{
  "intent": "調整",
  "range": "",
  "title": "打ち合わせ",
  "date": "",
  "start": "",
  "end": "",
  "durationMinutes": 60,
  "candidateNumber": null,
  "weekOffset": 0,
  "originalDateText": "",
  "sourceType": "group",
  "replyText": "候補日時を確認します。"
}
```

### 次週リスケ

```json
{
  "intent": "リスケ",
  "range": "",
  "title": "",
  "date": "",
  "start": "",
  "end": "",
  "durationMinutes": 60,
  "candidateNumber": null,
  "weekOffset": 1,
  "originalDateText": "次週",
  "sourceType": "group",
  "replyText": "次週で候補を確認します。"
}
```

### 候補確定

```json
{
  "intent": "確定",
  "range": "",
  "title": "",
  "date": "",
  "start": "",
  "end": "",
  "durationMinutes": 60,
  "candidateNumber": 1,
  "weekOffset": 0,
  "originalDateText": "1番",
  "sourceType": "group",
  "replyText": "1番の候補で確定します。"
}
```

## 注意

OpenAIの返却JSONは、Make側で `Parse JSON` してください。

日時の完全な変換はOpenAIだけに任せすぎず、Make側のDate関数や追加処理で補正する方が安全です。
