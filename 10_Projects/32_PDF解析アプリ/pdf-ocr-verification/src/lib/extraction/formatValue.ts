/**
 * 抽出されたテキストをデータ型 (dataType) に応じて確認用に自動整形する。
 * （元文字の保持が前提のため、これはサジェスト値としてのみ使用される）
 */
export function formatValue(text: string, dataType: string): string {
  if (!text) return "";

  // 全角数字を半角数字に変換するヘルパー関数
  const toHalfWidthNumbers = (str: string) => {
    return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  };

  switch (dataType) {
    case "text":
    case "multiline":
      return text;
      
    case "integer":
      // 数字とマイナス記号以外を除外
      return toHalfWidthNumbers(text).replace(/[^\d-]/g, '');
      
    case "decimal":
      // 数字、マイナス記号、小数点以外を除外
      return toHalfWidthNumbers(text).replace(/[^\d.-]/g, '');
      
    case "currency":
      // 通貨記号やカンマ等を除き、数値候補とする
      return toHalfWidthNumbers(text).replace(/[^\d.-]/g, '');
      
    case "date":
      // 日付っぽい文字（スラッシュ、ハイフン、年月日など）を残す
      // 厳密な変換ではなくノイズ除去程度
      return toHalfWidthNumbers(text).replace(/[^\d/\-年月日時分秒]/g, '').trim();
      
    case "time":
      // 時刻っぽい文字
      return toHalfWidthNumbers(text).replace(/[^\d:時分秒]/g, '').trim();
      
    default:
      return text;
  }
}
