# データ構造 (Data Schema)

## スプレッドシート構成

| シート名 | 役割 | 主要カラム |
| :--- | :--- | :--- |
| **生ログ** | Webhookの全生データ | `timestamp`, `type`, `userId`, `data(JSON)` |
| **ログ** | 解析済みの操作履歴 | `ts`, `displayName`, `msg`, `gid`, `status` |
| **マスタ** | 現在の確定シフト情報 | `date`, `time`, `team`, `user`, `status` |
| **ユーザーマスタ** | IDと名前の紐付け | `userId`, `displayName`, `lastUpdated` |
| **人数設定** |  staffing 基準値 | `date`, `time`, `team`, `required_count` |
| **パターンマスター** | 登録用の選択肢定義 | `ラベル`, `チーム`, `時間帯` |
| **エラーログ** | システムエラー記録 | `timestamp`, `where`, `message`, `stack` |

## 状態管理
- **ユーザー状態 (User State)**: キャッシュサービス (`CacheService`) を使用し、対話のコンテキスト（開始日選択済みか、など）を一時的に保持する。
- **キャッシュキー**: `ST_{userId}` (有効期限 600秒)
