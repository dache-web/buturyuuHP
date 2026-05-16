# LINE UserID の名前解決とキャッシュ戦略

## 課題
LINE Messaging API で UserID からプロフィール（表示名）を取得する場合、以下の課題がある：
1. **API制限**: 頻繁に API を叩くとレートリミットに達する可能性がある。
2. **パフォーマンス**: API 通信は遅延（オーバーヘッド）が発生する。
3. **可視化**: スプレッドシート上では UserID (U1234...) よりも表示名の方が圧倒的に扱いやすい。

## 解決策
「3レイヤー・キャッシュ・戦略」を実装する。

### 1. Script Cache (RAM 相当)
`CacheService` を使用し、数時間単位で名前を保持。
```javascript
const cache = CacheService.getScriptCache();
const cachedName = cache.get("USER_NAME_" + userId);
if (cachedName) return cachedName;
```

### 2. User Master Sheet (Database 相当)
スプレッドシートに UserID と名前のペアを保存。キャッシュが切れても API を叩かずに済む。
```javascript
const userRow = data.find(r => r[0] === userId);
if (userRow) return userRow[1];
```

### 3. Profile API (Origin 相当)
上記2つに存在しない場合のみ API を叩き、結果をマスタとキャッシュに書き戻す。
```javascript
const res = UrlFetchApp.fetch(url, { headers: { Authorization: token } });
const name = JSON.parse(res).displayName;
// 保存処理...
```

## メリット
- **UX向上**: スプレッドシートを見るだけで誰のデータか即座に判別できる。
- **堅牢性**: API がダウンしていても、過去に接触したユーザーの名前は解決できる。
- **コスト最適化**: 不要な API コールを最小限に抑えられる。
