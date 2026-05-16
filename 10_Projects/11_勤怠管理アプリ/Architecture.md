# システム設計 (Architecture)

## 全体構成
本システムは「ログ・ドリブン・アーキテクチャ」を採用している。
全てのユーザーアクションはまずログとして記録され、そのログを基に最新の「マスタ（現在の状態）」を再構築する。これにより、データの整合性と追跡可能性を確保している。

## モジュール構成
### 1. LINE Gateway (`doPost` / `handleEvent`)
- Webhook を受け取り、`生ログ`に保存。
- イベントの種類（Message, Postback）に応じて処理を振り分け。
- ユーザーへのレスポンス（Push/Reply）を担当。

### 2. User Manager (`getDisplayName`)
- **役割**: UserID -> 人間に読める名前への変換。
- **仕組み**:
  1. Script Cache を確認（高速）
  2. `ユーザーマスタ`シートを確認（永続）
  3. LINE Profile API を叩く（最終手段）
- これにより、スプレッドシート上での可視化が大幅に向上する。

### 3. Business Logic (`updateMaster` / `recalcAndNotify`)
- `updateMaster`: ログシートを走査し、最新のシフト情報を抽出してマスタを更新。
- `recalcAndNotify`: マスタと設定値を比較し、過不足があれば通知ロジックを走査。

### 4. Web UI (`doGet` / `submitShift`)
- 複雑な入力（カレンダー選択など）を HTML フォームで提供。
- `google.script.run` を介してサーバーサイド関数を実行。

## エラーハンドリング
- 全ての主要関数は `try-catch` で囲まれ、`エラーログ`シートに詳細（スタックトレース含む）を記録する。
- ユーザーには「⚠️ エラーが発生しました」と簡潔に通知。
