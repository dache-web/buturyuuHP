import { TextElement } from "@/types/pdf-ocr/pdfAnalysis";
import { groupElementsByColumnHeaders, ColumnGroupingResult } from "./columnGrouping";
import { groupElementsByRowHeaders, RowGroupingResult } from "./rowGrouping";

export interface TariffCellMapping {
  weightText: string;     // 例: "10kg"
  weightValue: number;    // 例: 10
  distanceText: string;   // 例: "50km"
  freightText: string;    // 例: "1,230円"
  freightValue: number | null; // 例: 1230
  rowY: number;
  colX: number;
}

export interface TariffMatrixResult {
  success: boolean;
  mappings: TariffCellMapping[];
  rowCount: number;
  colCount: number;
  summaryMessage: string;
}

/**
 * PDF選択領域のTextElement[]から物理X/Y座標に基づいて
 * 「重量 (行) × 距離 (列) = 運賃 (交点セル)」
 * の対応関係（行列構造）を自動抽出する最小エンジン
 */
export function buildTariffMatrix(elements: TextElement[]): TariffMatrixResult {
  if (!elements || elements.length === 0) {
    return {
      success: false,
      mappings: [],
      rowCount: 0,
      colCount: 0,
      summaryMessage: "要素が0件のためマッピングできません。",
    };
  }

  // 1. C-1 による列グループ（距離列 50km, 100kmなど）抽出
  const colGroupingRes: ColumnGroupingResult = groupElementsByColumnHeaders(elements);
  const colGroups = colGroupingRes.columnGroups;

  // 2. C-2 による行グループ（重量行 10, 20, 30kgなど）抽出
  const rowGroupingRes: RowGroupingResult = groupElementsByRowHeaders(elements);
  const rowGroups = rowGroupingRes.rowGroups;

  if (colGroups.length === 0 || rowGroups.length === 0) {
    return {
      success: false,
      mappings: [],
      rowCount: rowGroups.length,
      colCount: colGroups.length,
      summaryMessage: `距離列(${colGroups.length}件)または重量行(${rowGroups.length}件)が認識されませんでした。`,
    };
  }

  const mappings: TariffCellMapping[] = [];

  // 座標取得用ヘルパー
  const getBounds = (el: TextElement) => {
    const coords = el.normalizedCoordinates || el.originalCoordinates;
    return {
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.height,
      centerX: coords.x + coords.width / 2,
      centerY: coords.y + coords.height / 2,
    };
  };

  // 各行・各列の組み合わせで交点要素を特定
  for (const rowGroup of rowGroups) {
    const weightText = rowGroup.headerText.includes("kg") ? rowGroup.headerText : `${rowGroup.headerText}kg`;
    const parsedWeight = parseInt(rowGroup.headerText.replace(/[^\d]/g, ""), 10) || 0;

    for (let colIdx = 0; colIdx < colGroups.length; colIdx++) {
      const colGroup = colGroups[colIdx];
      const distanceText = colGroup.headerText.includes("km") ? colGroup.headerText : `${colGroup.headerText}km`;

      // 列のX境界を定義
      const colCenterX = colGroup.headerCenterX;
      // 隣の列とのの中間点を列境界とする
      let leftBound = 0;
      let rightBound = 1;

      if (colIdx === 0) {
        rightBound = colIdx + 1 < colGroups.length
          ? (colCenterX + colGroups[colIdx + 1].headerCenterX) / 2
          : colCenterX + 0.15;
        leftBound = colCenterX - 0.15;
      } else if (colIdx === colGroups.length - 1) {
        leftBound = (colGroups[colIdx - 1].headerCenterX + colCenterX) / 2;
        rightBound = colCenterX + 0.15;
      } else {
        leftBound = (colGroups[colIdx - 1].headerCenterX + colCenterX) / 2;
        rightBound = (colCenterX + colGroups[colIdx + 1].headerCenterX) / 2;
      }

      // 該当交点に位置する候補要素を検索
      // 行の見出しY座標との垂直差が小さく、列のX範囲内にある要素
      const matchingEls = elements.filter((el) => {
        // ヘッダー要素自体を除外
        if (el.text === colGroup.headerText || el.text === rowGroup.headerText) return false;
        if (el.text.includes("km") || el.text.includes("区分") || el.text.includes("運賃")) return false;

        // 数値を含む要素（地域名などの漢字テキストを除外）かつヘッダー自身を除く
        if (!/\d/.test(el.text.trim())) return false;

        const b = getBounds(el);
        const yDiff = Math.abs(b.centerY - rowGroup.headerCenterY);
        // 通常の行の高さ (相対座標で約0.02~0.05) 内に収まるか
        const inRow = yDiff <= 0.035;
        const inCol = b.centerX >= leftBound && b.centerX <= rightBound;
        return inRow && inCol;
      });

      if (matchingEls.length > 0) {
        // 最も相応しい要素（数値表現を含むものを優先）
        const primaryEl = matchingEls[0];
        const rawText = primaryEl.text.trim();
        const numOnly = rawText.replace(/[^\d]/g, "");
        const freightVal = numOnly ? parseInt(numOnly, 10) : null;
        const freightText = numOnly ? `${Number(numOnly).toLocaleString()}円` : rawText;

        mappings.push({
          weightText,
          weightValue: parsedWeight,
          distanceText,
          freightText,
          freightValue: freightVal,
          rowY: rowGroup.headerCenterY,
          colX: colGroup.headerCenterX,
        });
      }
    }
  }

  const success = mappings.length > 0;
  const summaryMessage = success
    ? `重量 ${rowGroups.length}行 × 距離 ${colGroups.length}列 ➔ 運賃マッピング ${mappings.length}件 成立`
    : "交点セルに該当する運賃データが見つかりませんでした。";

  return {
    success,
    mappings,
    rowCount: rowGroups.length,
    colCount: colGroups.length,
    summaryMessage,
  };
}

