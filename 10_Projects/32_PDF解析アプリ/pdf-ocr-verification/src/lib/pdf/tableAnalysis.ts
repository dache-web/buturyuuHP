import { TextElement, TableAnalysis, TableColumn, TableRow, TableCell } from "@/types/pdfAnalysis";
import { TableAnalysisConfig } from "./tableAnalysisConfig";

export function analyzeTable(pageNumber: number, elements: TextElement[]): { isTableCandidate: boolean, tableResult: TableAnalysis | undefined } {
  if (elements.length === 0) {
    return { isTableCandidate: false, tableResult: undefined };
  }

  // 1. Group by Y coordinate to find row candidates
  // Sort elements by Y coordinate
  const sortedByY = [...elements].sort((a, b) => a.normalizedCoordinates.y - b.normalizedCoordinates.y);
  
  const rows: TextElement[][] = [];
  let currentRow: TextElement[] = [sortedByY[0]];
  
  for (let i = 1; i < sortedByY.length; i++) {
    const el = sortedByY[i];
    const prevEl = currentRow[currentRow.length - 1];
    
    const height = Math.max(el.normalizedCoordinates.height, prevEl.normalizedCoordinates.height);
    const yDiff = Math.abs(el.normalizedCoordinates.y - prevEl.normalizedCoordinates.y);
    
    // If y difference is within tolerance, group into same row
    if (yDiff <= height * TableAnalysisConfig.rowYToleranceRatio) {
      currentRow.push(el);
    } else {
      rows.push(currentRow);
      currentRow = [el];
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Filter out rows with only 1 element if we are strictly looking for tables, but let's keep them for now to calculate columns properly.
  const multiElementRows = rows.filter(r => r.length > 1);
  
  if (multiElementRows.length < TableAnalysisConfig.minimumRows) {
    return { isTableCandidate: false, tableResult: undefined };
  }

  // 2. Group by X coordinate to find column candidates
  const allXStarts = elements.map(e => e.normalizedCoordinates.x).sort((a, b) => a - b);
  const columnStarts: number[] = [];
  
  for (const x of allXStarts) {
    const isNewCol = columnStarts.every(cx => Math.abs(cx - x) > TableAnalysisConfig.columnXTolerance);
    if (isNewCol) {
      columnStarts.push(x);
    }
  }
  
  if (columnStarts.length < TableAnalysisConfig.minimumColumns) {
    return { isTableCandidate: false, tableResult: undefined };
  }

  // Calculate table score
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Check multiple elements per row
  if (multiElementRows.length >= TableAnalysisConfig.minimumRows) {
    score += 40;
    reasons.push(`複数要素を持つ行が${multiElementRows.length}行あります。`);
  }

  // Check column consistency
  let consistentRows = 0;
  for (const r of multiElementRows) {
    // How many elements in this row align with our detected columns?
    let alignedCount = 0;
    for (const el of r) {
      const isAligned = columnStarts.some(cx => Math.abs(cx - el.normalizedCoordinates.x) <= TableAnalysisConfig.columnXTolerance);
      if (isAligned) alignedCount++;
    }
    if (alignedCount >= 2) consistentRows++;
  }
  
  if (consistentRows / multiElementRows.length >= TableAnalysisConfig.minimumRepeatedColumnRatio) {
    score += 40;
    reasons.push(`列の位置が揃っている行が${consistentRows}行あります。`);
  }

  // Check short text
  const shortTextCount = elements.filter(e => e.text.length <= TableAnalysisConfig.shortTextMaxLength).length;
  if (shortTextCount / elements.length >= 0.5) {
    score += 20;
    reasons.push(`短い文字列や数字が多く含まれています。`);
  }

  if (score < TableAnalysisConfig.minimumTableScore) {
    return { isTableCandidate: false, tableResult: undefined };
  }

  // Build the TableAnalysis object
  const tableColumns: TableColumn[] = columnStarts.map((cx, idx) => ({
    columnId: `col-${idx}`,
    columnName: `列 ${idx + 1}`,
    xStart: cx,
    xEnd: cx + 100, // rough estimate
    displayOrder: idx,
    isExcluded: false,
  }));

  const tableRows: TableRow[] = rows.map((r, rowIdx) => {
    // Sort elements in row by X coordinate
    r.sort((a, b) => a.normalizedCoordinates.x - b.normalizedCoordinates.x);
    
    const cells: TableCell[] = [];
    
    for (const el of r) {
      // Find matching column
      let matchedCol = tableColumns[0];
      let minDiff = Number.MAX_VALUE;
      
      for (const col of tableColumns) {
        const diff = Math.abs(col.xStart - el.normalizedCoordinates.x);
        if (diff < minDiff && diff <= TableAnalysisConfig.columnXTolerance) {
          minDiff = diff;
          matchedCol = col;
        }
      }
      
      if (minDiff <= TableAnalysisConfig.columnXTolerance) {
        cells.push({
          columnId: matchedCol.columnId,
          originalText: el.text,
          finalText: el.text,
          sourceElementIds: [el.id],
          x: el.normalizedCoordinates.x,
          y: el.normalizedCoordinates.y,
          width: el.normalizedCoordinates.width,
          height: el.normalizedCoordinates.height,
          confidence: el.confidence
        });
      }
    }

    return {
      rowId: `row-${rowIdx}`,
      pageNumber: pageNumber,
      rowOrder: rowIdx,
      cells: cells,
      sourceElementIds: r.map(e => e.id),
      isExcluded: false
    };
  });

  return {
    isTableCandidate: true,
    tableResult: {
      tableId: `table-p${pageNumber}`,
      pageNumber: pageNumber,
      columnCount: tableColumns.length,
      rowCount: tableRows.length,
      columns: tableColumns,
      rows: tableRows,
      confidence: score,
      tableScore: score,
      tableReasons: reasons,
      tableWarnings: warnings
    }
  };
}
