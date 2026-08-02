/**
 * 抽出した複数の文字列を、指定された結合方法（joinMethod）で結合する
 */
export function joinElementsText(texts: string[], joinMethod: string): string {
  if (!texts || texts.length === 0) return "";
  
  switch (joinMethod) {
    case "none":
    case "no_space":
      return texts.join("");
    case "space":
      return texts.join(" ");
    case "full_space":
      return texts.join("　");
    case "newline":
      return texts.join("\n");
    case "comma":
      return texts.join(",");
    default:
      // デフォルトは改行で結合（安全のため）
      return texts.join("\n");
  }
}
