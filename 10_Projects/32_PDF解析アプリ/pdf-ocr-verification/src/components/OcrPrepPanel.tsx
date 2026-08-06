import React from "react";
import { PdfAnalysisData } from "@/types/pdfAnalysis";
import styles from "@/app/page.module.css";

interface Props {
  data: PdfAnalysisData;
  currentPage: number;
}

export default function OcrPrepPanel({ data, currentPage }: Props) {
  const page = data.pages.find((p) => p.pageNumber === currentPage);

  if (!page) {
    return <p>ページデータがありません。</p>;
  }

  if (page.pageType !== "image" && page.pageType !== "mixed") {
    return (
      <div style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
        <p>このページはOCRが必要な画像ページとしては判定されていません。</p>
        <p>現在の判定: <strong>{page.pageType}</strong></p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ backgroundColor: "#fef2f2", padding: "1rem", borderRadius: "8px", border: "1px solid #fca5a5" }}>
        <h3 style={{ margin: "0 0 0.5rem 0", color: "#991b1b" }}>OCR解析が必要なページです</h3>
        <p style={{ margin: "0 0 1rem 0", color: "#7f1d1d" }}>
          このページにはPDF内部の文字情報がありません（または画像が含まれています）。
          画像として保存されている可能性があるため、文字を読み取るにはOCRが必要です。
        </p>
        
        <div style={{ backgroundColor: "white", padding: "1rem", borderRadius: "4px", marginBottom: "1rem" }}>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#374151" }}>
            <li><strong>対象ページ番号:</strong> {page.pageNumber}</li>
            <li><strong>判定理由:</strong> {page.classificationReason || "不明"}</li>
            <li><strong>画像生成の可否:</strong> 準備完了 (Canvasからの画像生成が可能)</li>
            <li><strong>OCR送信状態:</strong> {page.ocrResult?.status || "ready"}</li>
            <li><strong>外部送信:</strong> まだ外部送信していません。</li>
          </ul>
        </div>

        <button 
          className={styles.btn} 
          style={{ backgroundColor: "#ef4444", color: "white", border: "none" }}
          onClick={() => alert("今回の開発フェーズでは外部OCRサービスへの送信は行いません。")}
        >
          OCR解析の準備確認（送信しません）
        </button>
      </div>
    </div>
  );
}
