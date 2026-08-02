import { PageAnalysis, TextElement, TableAnalysis, TableCell } from "@/types/pdfAnalysis";
import { google } from "@google-cloud/documentai/build/protos/protos";

export function normalizeDocumentAiResult(
  document: google.cloud.documentai.v1.IDocument,
  pageNumber: number,
  processingTimeMs: number
): Partial<PageAnalysis> {
  const elements: TextElement[] = [];
  let readingOrder = 1;

  const text = document.text || "";
  const pages = document.pages || [];
  const page = pages[0]; // We sent 1 image = 1 page
  
  if (page && page.tokens) {
    for (const token of page.tokens) {
      if (!token.layout || !token.layout.textAnchor || !token.layout.boundingPoly) continue;
      
      const startIndex = Number(token.layout.textAnchor.textSegments?.[0]?.startIndex || 0);
      const endIndex = Number(token.layout.textAnchor.textSegments?.[0]?.endIndex || 0);
      const tokenText = text.substring(startIndex, endIndex);

      const normVertices = token.layout.boundingPoly.normalizedVertices || [];
      const nx = normVertices[0]?.x || 0;
      const ny = normVertices[0]?.y || 0;
      
      let nw = 0;
      let nh = 0;
      if (normVertices.length >= 3) {
        nw = Math.abs((normVertices[1]?.x || nx) - nx);
        if (nw === 0 && normVertices[2]?.x) {
          nw = Math.abs(normVertices[2].x - nx);
        }
        nh = Math.abs((normVertices[2]?.y || ny) - ny);
      }
      
      const pxVertices = token.layout.boundingPoly.vertices || [];
      const x = pxVertices[0]?.x || 0;
      const y = pxVertices[0]?.y || 0;
      
      let width = 0;
      let height = 0;
      if (pxVertices.length >= 3) {
        width = Math.abs((pxVertices[1]?.x || x) - x);
        if (width === 0 && pxVertices[2]?.x) {
          width = Math.abs(pxVertices[2].x - x);
        }
        height = Math.abs((pxVertices[2]?.y || y) - y);
      }

      const confidence = token.layout.confidence !== undefined && token.layout.confidence !== null 
        ? token.layout.confidence 
        : null;

      elements.push({
        id: `page-${pageNumber}-ocr-element-${readingOrder}`,
        pageNumber,
        elementType: "ocr_text_item",
        text: tokenText,
        readingOrder,
        source: "ocr",
        confidence,
        fontName: "unknown",
        hasEOL: tokenText.includes("\n"),
        originalCoordinates: { x, y, width, height },
        normalizedCoordinates: { x: nx, y: ny, width: nw, height: nh },
      });
      
      readingOrder++;
    }
  }

  // Calculate average confidence
  let totalConfidence = 0;
  let countConfidence = 0;
  for (const el of elements) {
    if (el.confidence !== null) {
      totalConfidence += el.confidence;
      countConfidence++;
    }
  }
  const averageConfidence = countConfidence > 0 ? totalConfidence / countConfidence : null;

  // Simple table extraction fallback
  const tables: TableAnalysis[] = [];
  if (page && page.tables) {
    let tableIndex = 1;
    for (const tbl of page.tables) {
      const cells: TableCell[] = [];
      const headerRows = tbl.headerRows || [];
      const bodyRows = tbl.bodyRows || [];
      
      let rowIndex = 0;
      
      const extractCells = (rows: google.cloud.documentai.v1.Document.Page.Table.ITableRow[]) => {
        for (const row of rows) {
          if (!row.cells) continue;
          let colIndex = 0;
          for (const cell of row.cells) {
            let cellText = "";
            if (cell.layout?.textAnchor?.textSegments) {
              for (const segment of cell.layout.textAnchor.textSegments) {
                const s = Number(segment.startIndex || 0);
                const e = Number(segment.endIndex || 0);
                cellText += text.substring(s, e);
              }
            }
            cells.push({
              rowIndex,
              colIndex,
              text: cellText.trim()
            });
            colIndex++;
          }
          rowIndex++;
        }
      };

      extractCells(headerRows);
      extractCells(bodyRows);
      
      const columnCount = cells.length > 0 ? Math.max(...cells.map(c => c.colIndex)) + 1 : 0;
      
      tables.push({
        tableId: `page-${pageNumber}-table-${tableIndex}`,
        pageNumber,
        rowCount: rowIndex,
        columnCount,
        confidence: tbl.layout?.confidence || 0,
        cells
      });
      tableIndex++;
    }
  }

  return {
    processingTimeMs,
    ocrResult: {
      status: "success",
      text,
      elements,
      elementCount: elements.length,
      textLength: text.length,
      provider: "google_document_ai",
      averageConfidence,
      tables,
    }
  };
}
