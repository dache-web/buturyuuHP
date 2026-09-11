import { TextElement } from "@/types/pdf-ocr/pdfAnalysis";
import { DocumentRegion, PdfExtractionTransferData, PdfExtractionOutputItem } from "@/types/pdf-ocr/tableSchema";

/**
 * 読み取ったPDFの要素と領域情報から、計算や推測を行わずに
 * 「どこから読んだ何の値か」を追跡できる純粋な転送用データを構築する純粋関数
 */
export function buildPdfExtractionTransferData(
  fileId: string,
  fileName: string,
  pageCount: number,
  regions: DocumentRegion[],
  allElements: TextElement[]
): PdfExtractionTransferData {
  const items: PdfExtractionOutputItem[] = [];

  for (const region of regions) {
    const regionEls = (region.textElementIds || [])
      .map((id) => allElements.find((e) => e.id === id))
      .filter(Boolean) as TextElement[];

    if (regionEls.length === 0) {
      if (region.sourceText) {
        const bounds = region.actualBounds || region.bounds;
        items.push({
          fileId,
          page: region.page,
          itemName: region.semanticType || "未設定",
          rawText: region.sourceText,
          value: region.sourceText,
          x: bounds ? Number(bounds.x.toFixed(4)) : 0,
          y: bounds ? Number(bounds.y.toFixed(4)) : 0,
          width: bounds ? Number(bounds.width.toFixed(4)) : 0,
          height: bounds ? Number(bounds.height.toFixed(4)) : 0,
          row: null,
          column: null,
          readingUncertain: false,
        });
      }
      continue;
    }

    // Y座標でソートして行分け、X座標で列ソート
    const sortedEls = [...regionEls].sort((a, b) => {
      const aCoord = a.normalizedCoordinates || a.originalCoordinates;
      const bCoord = b.normalizedCoordinates || b.originalCoordinates;
      const yDiff = Math.abs(aCoord.y - bCoord.y);
      if (yDiff < 0.015) {
        return aCoord.x - bCoord.x;
      }
      return aCoord.y - bCoord.y;
    });

    // 行・列の推定インデックスの計算 (位置座標からのインデックス付与)
    const rowYList: number[] = [];
    for (const el of sortedEls) {
      const coord = el.normalizedCoordinates || el.originalCoordinates;
      const existingY = rowYList.find((y) => Math.abs(y - coord.y) < 0.015);
      if (existingY === undefined) {
        rowYList.push(coord.y);
      }
    }
    rowYList.sort((a, b) => a - b);

    const colXList: number[] = [];
    for (const el of sortedEls) {
      const coord = el.normalizedCoordinates || el.originalCoordinates;
      const existingX = colXList.find((x) => Math.abs(x - coord.x) < 0.02);
      if (existingX === undefined) {
        colXList.push(coord.x);
      }
    }
    colXList.sort((a, b) => a - b);

    for (const el of sortedEls) {
      const coord = el.normalizedCoordinates || el.originalCoordinates;
      const rowIndex = rowYList.findIndex((y) => Math.abs(y - coord.y) < 0.015) + 1;
      const colIndex = colXList.findIndex((x) => Math.abs(x - coord.x) < 0.02) + 1;

      items.push({
        fileId,
        page: el.pageNumber || region.page,
        itemName: region.semanticType || "未設定",
        rawText: el.text,
        value: el.text.trim(),
        x: Number(coord.x.toFixed(4)),
        y: Number(coord.y.toFixed(4)),
        width: Number(coord.width.toFixed(4)),
        height: Number(coord.height.toFixed(4)),
        row: rowIndex > 0 ? rowIndex : null,
        column: colIndex > 0 ? colIndex : null,
        readingUncertain: el.confidence !== null && el.confidence < 0.7,
      });
    }
  }

  return {
    fileId,
    fileName,
    pageCount,
    extractedAt: new Date().toISOString(),
    items,
  };
}

