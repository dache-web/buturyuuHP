import { TextElement } from "@/types/pdf-ocr/pdfAnalysis";
import { SelectionArea } from "@/types/pdf-ocr/extractionAssignment";

/**
 * ドラッグ選択領域と文字の画面表示領域を直接比較し、選択された文字要素を抽出する。
 * 基本条件: 文字の表示中心点がドラッグ選択矩形内にある場合
 * 補助条件: 文字の表示矩形全体が選択範囲内に収まっている場合
 * 
 * @param elements 対象ページの全文字要素
 * @param area ドラッグされた選択矩形（表示座標系）
 * @returns 選択された文字要素の配列
 */
export function getElementsInSelectionArea(elements: TextElement[], area: SelectionArea): TextElement[] {
  const selectedElements: TextElement[] = [];

  const areaLeft = area.x;
  const areaRight = area.x + area.width;
  const areaTop = area.y;
  const areaBottom = area.y + area.height;

  for (const el of elements) {
    const coords = el.normalizedCoordinates;
    const elLeft = coords.x;
    const elRight = coords.x + coords.width;
    const elTop = coords.y;
    const elBottom = coords.y + coords.height;

    // 文字枠の表示中心点
    const centerX = elLeft + coords.width / 2;
    const centerY = elTop + coords.height / 2;

    // 1. 基本条件: 中心点がドラッグ矩形内にある
    const isCenterInside = (
      centerX >= areaLeft &&
      centerX <= areaRight &&
      centerY >= areaTop &&
      centerY <= areaBottom
    );

    // 2. 補助条件: 文字の表示領域全体が選択枠内に完全に収まっている
    const isFullyContained = (
      elLeft >= areaLeft &&
      elRight <= areaRight &&
      elTop >= areaTop &&
      elBottom <= areaBottom
    );

    if (isCenterInside || isFullyContained) {
      selectedElements.push(el);
    }
  }

  return selectedElements;
}


