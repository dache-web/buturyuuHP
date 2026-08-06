import React from "react";
import { PdfAnalysisData, TableAnalysis, TableColumn, TableRow } from "@/types/pdfAnalysis";
import styles from "@/app/page.module.css";

interface Props {
  data: PdfAnalysisData;
  currentPage: number;
}

export default function TablePreviewPanel({ data, currentPage }: Props) {
  const page = data.pages.find((p) => p.pageNumber === currentPage);
  const tableResult = page?.tableResult;

  if (!page) {
    return <p>ページデータがありません。</p>;
  }

  if (page.pageType !== "table_candidate") {
    return (
      <div style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
        <p>このページは表候補として判定されていません。</p>
        <p>現在の判定: <strong>{page.pageType}</strong></p>
        {page.classificationReason && <p>理由: {page.classificationReason}</p>}
      </div>
    );
  }

  if (!tableResult) {
    return <p>表の解析結果がありません。</p>;
  }

  const handleExcludeRow = (rowId: string) => {
    // For now, this is a visual demo component. 
    // State management for exclusion would require passing a setter for analysisData or separate state.
    // Given the constraints, we might just alert or manage local state.
    alert(`行 ${rowId} を除外フラグにします（未実装）`);
  };

  const handleExcludeCol = (colId: string) => {
    alert(`列 ${colId} を除外フラグにします（未実装）`);
  };

  const activeColumns = tableResult.columns.filter(c => !c.isExcluded).sort((a, b) => a.displayOrder - b.displayOrder);
  const activeRows = tableResult.rows.filter(r => !r.isExcluded).sort((a, b) => a.rowOrder - b.rowOrder);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ backgroundColor: "#eff6ff", padding: "1rem", borderRadius: "8px" }}>
        <h3 style={{ margin: "0 0 0.5rem 0" }}>表判定結果 (Score: {tableResult.tableScore})</h3>
        {page.classificationReason && <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>理由: {page.classificationReason}</p>}
        {tableResult.tableReasons && tableResult.tableReasons.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: "1.5rem", fontSize: "0.9rem" }}>
            {tableResult.tableReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
        <button className={styles.btn} style={{ marginTop: "1rem" }} onClick={() => alert("表候補を解除して text ページとして扱います（未実装）")}>
          表候補を解除する
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #cbd5e1", backgroundColor: "white" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #cbd5e1", padding: "0.5rem", backgroundColor: "#f1f5f9", width: "40px" }}>操作</th>
              {activeColumns.map(col => (
                <th key={col.columnId} style={{ border: "1px solid #cbd5e1", padding: "0.5rem", backgroundColor: "#f1f5f9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{col.columnName || col.columnId}</span>
                    <button onClick={() => handleExcludeCol(col.columnId)} style={{ background: "none", border: "none", cursor: "pointer", color: "red", padding: "2px" }}>×</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeRows.map(row => (
              <tr key={row.rowId}>
                <td style={{ border: "1px solid #cbd5e1", padding: "0.5rem", textAlign: "center", backgroundColor: "#f1f5f9" }}>
                  <button onClick={() => handleExcludeRow(row.rowId)} style={{ background: "none", border: "none", cursor: "pointer", color: "red" }}>除外</button>
                </td>
                {activeColumns.map(col => {
                  const cell = row.cells.find(c => c.columnId === col.columnId);
                  return (
                    <td key={col.columnId} style={{ border: "1px solid #cbd5e1", padding: "0.5rem" }}>
                      {cell ? cell.finalText : <span style={{ color: "#94a3b8" }}>(空白)</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
