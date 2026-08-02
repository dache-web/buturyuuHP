import { TextElement } from "@/types/pdfAnalysis";

/**
 * 文字要素を以下の優先順位でソートする
 * 1. ページ番号 (昇順)
 * 2. Y座標 (上から下)
 * 3. X座標 (左から右)
 * 
 * ただし、Y座標が僅かに違うだけで別の行と判定されないよう、
 * Y座標の差が一定以下（例: 0.01 = 1%）の場合は同じ行とみなし、X座標で比較する。
 */
export function sortElements(elements: TextElement[]): TextElement[] {
  const Y_TOLERANCE = 0.01;

  return [...elements].sort((a, b) => {
    // 1. ページ番号で比較（抽出機能ではページ番号がTextElementに直接ない場合は不要だが、複数ページ結合を考慮）
    // 現状TextElementにはpageNumberがないため、呼び出し元でページごとの管理を前提とするか、
    // もしプロパティがあれば使う（今回はPDFViewerの1ページ内でのソートが主だが、一応考慮）
    // ここではページ内の要素配列を渡される前提とするためY,Xでのソートのみ行う
    
    const yDiff = a.normalizedCoordinates.y - b.normalizedCoordinates.y;
    
    if (Math.abs(yDiff) > Y_TOLERANCE) {
      return yDiff;
    }
    
    // Y座標がほぼ同じなら、X座標で左から右にソート
    return a.normalizedCoordinates.x - b.normalizedCoordinates.x;
  });
}
