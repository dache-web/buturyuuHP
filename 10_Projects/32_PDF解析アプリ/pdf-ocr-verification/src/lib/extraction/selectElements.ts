import { TextElement } from "@/types/pdfAnalysis";
import { SelectionArea } from "@/types/extractionAssignment";

/**
 * 矩形と文字枠の重なり判定を行い、選択範囲内の文字要素を抽出する。
 * 面積比率が30%以上重なっている要素を選択対象とする。
 * 
 * @param elements 対象ページの全文字要素
 * @param area ドラッグされた選択矩形（正規化座標）
 * @returns 選択された文字要素の配列
 */
export function getElementsInSelectionArea(elements: TextElement[], area: SelectionArea): TextElement[] {
  const selectedElements: TextElement[] = [];

  const areaLeft = area.x;
  const areaRight = area.x + area.width;
  const areaTop = area.y;
  const areaBottom = area.y + area.height;

  for (const el of elements) {
    const elLeft = el.normalizedCoordinates.x;
    const elRight = el.normalizedCoordinates.x + el.normalizedCoordinates.width;
    const elTop = el.normalizedCoordinates.y;
    const elBottom = el.normalizedCoordinates.y + el.normalizedCoordinates.height;

    // 重なっている部分の矩形を計算
    const overlapLeft = Math.max(areaLeft, elLeft);
    const overlapRight = Math.min(areaRight, elRight);
    const overlapTop = Math.max(areaTop, elTop);
    const overlapBottom = Math.min(areaBottom, elBottom);

    // 重なり幅と高さ（負の場合は重なりなし）
    const overlapWidth = Math.max(0, overlapRight - overlapLeft);
    const overlapHeight = Math.max(0, overlapBottom - overlapTop);
    const overlapArea = overlapWidth * overlapHeight;

    // 要素自体の面積
    const elementArea = el.normalizedCoordinates.width * el.normalizedCoordinates.height;

    // 重なり比率（要素面積に対する重なり面積の割合）
    if (elementArea > 0) {
      const overlapRatio = overlapArea / elementArea;
      if (overlapRatio >= 0.3) {
        selectedElements.push(el);
      }
    }
  }

  return selectedElements;
}
