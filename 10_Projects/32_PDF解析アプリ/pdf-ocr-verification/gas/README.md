# PDFデータ変換管理 GASバックアップ

このディレクトリは、管理スプレッドシートにバインドされているGAS（Google Apps Script）のソースコードのバックアップです。

## スプレッドシート情報
- **管理スプレッドシート名**: pdf読み取りアプリ (または PDFデータ変換_管理)
- **スプレッドシートID**: `10jdFZBzxg8Xug1H8u8P-sVo0nTDyzV0f3Hj0xVwQ7IM`
- **GAS Web API URL**: `https://script.google.com/macros/s/AKfycbzFAJB4sOn7Rzn2V1VwzkEpdzY4yDsBnYsUfa7BJTgiy0Ccg623FkXArLMicST3sVhvwQ/exec`

## 含まれる関数
- **初期化関数**: `setupPdfDataConversionSpreadsheet()`
- **完全再作成関数**: `rebuildPdfDataConversionSpreadsheet()` (確認ダイアログ付き)
- **テスト関数**: `testAllSetup()` (9種のテストを一括実行)

## Web API アクション一覧 (読み取り専用)
- `?action=settings` : 01_基本設定の取得
- `?action=rules` : 02_ルールマスタの取得
- `?action=fields&ruleId=...` : 03_項目マスタの取得
- `?action=output-settings&ruleId=...` : 04_出力先設定の取得
- `?action=choices&type=...` : 08_選択肢マスタの取得

## デプロイ方法
1. スプレッドシートのメニューから「拡張機能」＞「Apps Script」を開く。
2. `Code.gs` 等にコードを貼り付け、保存。
3. 右上の「デプロイ」＞「新しいデプロイ」で「種類の選択：ウェブアプリ」を選ぶ。
4. 「アクセスできるユーザー」を適切に設定し、「デプロイ」を実行。発行されたウェブアプリのURLをNext.jsの環境変数に設定する。

## 【重要】再デプロイ時の注意事項
今回のAPIは**読み取り専用**であるため、API URLを `.env.local` の `NEXT_PUBLIC_GAS_API_URL` としてフロントエンドへ公開しています。
**将来的に書き込みAPIや認証情報、秘密値等を追加する場合は、`NEXT_PUBLIC` プレフィックスのついた環境変数には絶対に置かず、Next.jsのサーバーサイド（API RoutesやServer Actions等）で隠蔽するように実装を変更してください。**
