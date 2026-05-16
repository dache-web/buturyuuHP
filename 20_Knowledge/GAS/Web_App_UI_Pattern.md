# LINE × GAS Web App 連携パターン

## 概要
LINE チャットボットの利便性と、Web アプリ (GAS Web App) の豊かな表現力を組み合わせる強力な設計パターン。
LIFF (LINE Front-end Framework) を導入せずに、標準の GAS Web アプリ機能だけで「アプリのような体験」を提供することを目的とする。

## なぜこの手法が強力なのか？
1. **複雑な入力の簡略化**:
   - チャットでの対話形式では難しい「期間選択」「複数項目の一括設定」「複雑なバリデーション」を 1 画面で完結できる。
2. **UX の向上**:
   - モダンな CSS フレームワークやアニメーションを使用でき、ユーザーに「プレミアムな体験」を提供できる。
3. **パラメータの受け渡し**:
   - URL パラメータを使用して、LINE UserID などのコンテキストを Web アプリ側に引き継げる。
4. **開発コストの低減**:
   - LIFF のような複雑な設定や審査（チャネル作成等）が不要で、GAS の `doGet` だけで完結する。

## 実装のポイント

### 1. Backend (Code.gs)
URL パラメータから `userId` を受け取り、HTML テンプレートに埋め込む。

```javascript
function doGet(e) {
  const userId = e.parameter.userId || "";
  const template = HtmlService.createTemplateFromFile('index');
  template.userId = userId; // テンプレート内で使用可能にする
  
  return template.evaluate()
    .setTitle('システム名')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // 埋め込み許可
    .addMetaTag('viewport', 'width=device-width, initial-scale=1'); // モバイル最適化
}
```

### 2. Frontend (index.html)
埋め込まれた `userId` を `hidden` フィールドなどで保持し、`google.script.run` でサーバーサイドへ送り返す。

```html
<input type="hidden" id="userId" value="<?= userId ?>">

<script>
  function submit() {
    const data = {
      userId: document.getElementById('userId').value,
      // ... 他のデータ
    };
    google.script.run.withSuccessHandler(onSuccess).yourServerFunction(data);
  }
</script>
```

### 3. LINE Gateway
ユーザーに Web アプリの URL を提示する際、自身の UserID を付与する。

```javascript
const url = ScriptApp.getService().getUrl() + "?userId=" + userId;
pushLine(targetId, "以下のリンクから入力してください：\n" + url);
```

## ベストプラクティス
- **モバイルファースト**: LINE 内ブラウザで開かれるため、レスポンシブ設計と大きなタッチターゲットが必須。
- **フィードバック**: 送信完了後に「完了しました。この画面を閉じてください」と明示し、ユーザーの迷いを防ぐ。
- **キャッシュの活用**: Web アプリ側でマスターデータを取得する際、GAS の `CacheService` を使用して読み込みを高速化する。
