import { useState } from "react";
import { PdfAnalysisData } from "@/types/pdfAnalysis";
import { getActiveResult } from "@/lib/pdf/activeResult";
import styles from "../app/page.module.css";

interface Props {
  data: PdfAnalysisData;
  currentPage: number;
  editedTexts: Record<number, string>;
}

export default function JsonPanel({ data, currentPage, editedTexts }: Props) {
  const [viewMode, setViewMode] = useState<"page" | "document">("page");

  if (!data) {
    return <p className={styles.noText}>解析結果はありません</p>;
  }

  const exportData = {
    ...data,
    pages: data.pages.map(page => {
      const active = getActiveResult(page, editedTexts[page.pageNumber]);
      return {
        ...page,
        originalText: page.pdfTextResult?.text || "",
        editedText: editedTexts[page.pageNumber] || null,
        finalText: active.finalText,
        isEdited: editedTexts[page.pageNumber] !== undefined,
        text: active.finalText,
      };
    })
  };

  let jsonData: unknown = exportData;
  if (viewMode === "page") {
    jsonData = exportData.pages.find(p => p.pageNumber === currentPage) || { error: "Page not found" };
  }

  const jsonString = JSON.stringify(jsonData, null, 2);

  return (
    <div className={styles.panelContent}>
      <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem" }}>
        <button 
          className={`${styles.btn} ${viewMode === "page" ? styles.btnPrimary : ""}`}
          onClick={() => setViewMode("page")}
        >
          現在ページJSON
        </button>
        <button 
          className={`${styles.btn} ${viewMode === "document" ? styles.btnPrimary : ""}`}
          onClick={() => setViewMode("document")}
        >
          文書全体JSON
        </button>
      </div>
      <pre className={styles.jsonView}>{jsonString}</pre>
    </div>
  );
}
