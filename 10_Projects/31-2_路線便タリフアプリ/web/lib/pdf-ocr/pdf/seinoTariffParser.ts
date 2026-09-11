import { TextElement } from "@/types/pdf-ocr/pdfAnalysis";
import { groupElementsByColumnHeaders } from "./columnGrouping";
import { groupElementsByRowHeaders } from "./rowGrouping";

export interface TariffDistanceGroup {
  groupId: string;          // 例: "dist_50"
  distanceText: string;     // 例: "50km"
  distanceKm: number;       // 例: 50
  destinations: string[];   // 例: ["岐阜", "大垣", "各務原", "四日市", "名古屋", "大府", "小牧"]
  columnX: number;
}

export interface TariffRowItem {
  weightText: string;       // 例: "10kg"
  weightKg: number;         // 例: 10
  rowY: number;
}

export interface TariffRateCell {
  weightText: string;       // 例: "10kg"
  weightKg: number;         // 例: 10
  distanceText: string;     // 例: "50km"
  distanceKm: number;       // 例: 50
  destinations: string[];   // 例: ["岐阜", "大垣", "各務原", "四日市", "名古屋", "大府", "小牧"]
  fareText: string;         // 例: "1,230円"
  fareYen: number | null;   // 例: 1230
  rowY: number;
  colX: number;
}

export interface SeinoStructuredTariffResult {
  success: boolean;
  distanceGroups: TariffDistanceGroup[];
  weightRows: TariffRowItem[];
  rates: TariffRateCell[];
  summaryMessage: string;
}

/**
 * 選択領域のTextElement[]から西濃運輸の実タリフ構造
 * 「重量 × 距離 × 複数地域 = 運賃」
 * の階層付き構造データ (destinations[]) を構築するパーサー関数
 */
export function parseSeinoTariffStructure(elements: TextElement[]): SeinoStructuredTariffResult {
  if (!elements || elements.length === 0) {
    return {
      success: false,
      distanceGroups: [],
      weightRows: [],
      rates: [],
      summaryMessage: "要素が選択されていません。",
    };
  }

  // 1. C-1 列グループ化 (距離ヘッダーと所属地域要素の抽出)
  const colRes = groupElementsByColumnHeaders(elements);
  const distanceGroups: TariffDistanceGroup[] = colRes.columnGroups.map((cg, idx) => {
    const distText = cg.headerText.includes("km") ? cg.headerText : `${cg.headerText}km`;
    const distKm = parseInt(cg.headerText.replace(/[^\d]/g, ""), 10) || 0;

    // 列に属する要素のうち、地域名漢字テキストを抽出 (数字やヘッダー自体を除く)
    const destinations = cg.elements
      .map((e) => e.text.trim())
      .filter((txt) => {
        if (!txt) return false;
        if (txt === cg.headerText || txt.includes("km") || txt.includes("区分") || txt.includes("運賃")) return false;
        // 数字のみの要素 (運賃や重量) を除外
        if (/^\d[\d,]*$/.test(txt)) return false;
        return true;
      });

    return {
      groupId: cg.groupId || `dist_${idx + 1}`,
      distanceText: distText,
      distanceKm: distKm,
      destinations: destinations.length > 0 ? destinations : ["地域未指定"],
      columnX: cg.headerCenterX,
    };
  });

  // 2. C-2 行グループ化 (重量行の抽出)
  const rowRes = groupElementsByRowHeaders(elements);
  const weightRows: TariffRowItem[] = rowRes.rowGroups.map((rg) => {
    const weightText = rg.headerText.includes("kg") ? rg.headerText : `${rg.headerText}kg`;
    const weightKg = parseInt(rg.headerText.replace(/[^\d]/g, ""), 10) || 0;
    return {
      weightText,
      weightKg,
      rowY: rg.headerCenterY,
    };
  });

  if (distanceGroups.length === 0 || weightRows.length === 0) {
    return {
      success: false,
      distanceGroups,
      weightRows,
      rates: [],
      summaryMessage: `距離列(${distanceGroups.length}件)または重量行(${weightRows.length}件)が不足しているためマッピングできません。`,
    };
  }

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

  // 3. 重量行 × 距離列 の交点運賃マッピング
  const rates: TariffRateCell[] = [];

  for (const row of weightRows) {
    for (let colIdx = 0; colIdx < distanceGroups.length; colIdx++) {
      const distGroup = distanceGroups[colIdx];

      // 列の境界X範囲
      const colCenterX = distGroup.columnX;
      let leftBound = colCenterX - 0.15;
      let rightBound = colCenterX + 0.15;

      if (colIdx === 0 && colIdx + 1 < distanceGroups.length) {
        rightBound = (colCenterX + distanceGroups[colIdx + 1].columnX) / 2;
      } else if (colIdx === distanceGroups.length - 1 && colIdx > 0) {
        leftBound = (distanceGroups[colIdx - 1].columnX + colCenterX) / 2;
      } else if (colIdx > 0 && colIdx + 1 < distanceGroups.length) {
        leftBound = (distanceGroups[colIdx - 1].columnX + colCenterX) / 2;
        rightBound = (colCenterX + distanceGroups[colIdx + 1].columnX) / 2;
      }

      // 該当交点に位置する運賃要素の検索
      const cellEls = elements.filter((el) => {
        const txt = el.text.trim();
        // ヘッダーや文字以外を除外
        if (txt === distGroup.distanceText || txt === row.weightText) return false;
        if (txt.includes("km") || txt.includes("区分") || txt.includes("運賃")) return false;
        if (!/\d/.test(txt)) return false; // 数値必須

        const b = getBounds(el);
        const yDiff = Math.abs(b.centerY - row.rowY);
        const inRow = yDiff <= 0.035;
        const inCol = b.centerX >= leftBound && b.centerX <= rightBound;
        return inRow && inCol;
      });

      if (cellEls.length > 0) {
        const primaryEl = cellEls[0];
        const rawText = primaryEl.text.trim();
        const numOnly = rawText.replace(/[^\d]/g, "");
        const fareYen = numOnly ? parseInt(numOnly, 10) : null;
        const fareText = numOnly ? `${Number(numOnly).toLocaleString()}円` : rawText;

        rates.push({
          weightText: row.weightText,
          weightKg: row.weightKg,
          distanceText: distGroup.distanceText,
          distanceKm: distGroup.distanceKm,
          destinations: distGroup.destinations,
          fareText,
          fareYen,
          rowY: row.rowY,
          colX: distGroup.columnX,
        });
      }
    }
  }

  const success = rates.length > 0;
  const summaryMessage = success
    ? `重量 ${weightRows.length}行 × 距離 ${distanceGroups.length}列 (全${rates.length}セル) 構造化完了`
    : "構造化データの生成に失敗しました。";

  return {
    success,
    distanceGroups,
    weightRows,
    rates,
    summaryMessage,
  };
}

