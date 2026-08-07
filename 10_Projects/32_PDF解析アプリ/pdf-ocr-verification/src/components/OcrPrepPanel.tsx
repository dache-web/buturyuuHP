import React from "react";
import { PdfAnalysisData } from "@/types/pdfAnalysis";
import styles from "@/app/page.module.css";
import { OcrDebugPanel } from "./OcrDebugPanel";

interface Props {
  data: PdfAnalysisData;
  currentPage: number;
  onRunOcr: (pageNumber: number) => void;
  onToggleOcrTarget: (pageNumber: number, target: boolean) => void;
}

export default function OcrPrepPanel({ data, currentPage, onRunOcr, onToggleOcrTarget }: Props) {
  const page = data.pages.find((p) => p.pageNumber === currentPage);

  if (!page) {
    return <p>ページデータがありません。</p>;
  }

  const isImageOrUnknown = page.pageType === "image" || page.pageType === "unknown";
  const ocrTarget = isImageOrUnknown || page.ocrResult?.status === "ready" || page.ocrResult?.status === "processing" || page.ocrResult?.status === "success" || page.ocrResult?.status === "failed";
  
  // OCR対象外の場合の表示
  if (!ocrTarget) {
    return (
      <div style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
        <p>このページはOCRが必要な画像ページとしては判定されていません。</p>
        <p>現在の判定: <strong>{page.pageType}</strong></p>
        {isImageOrUnknown && (
          <button className={styles.btn} onClick={() => onToggleOcrTarget(page.pageNumber, true)}>
            このページをOCR対象にする
          </button>
        )}
      </div>
    );
  }

  const status = page.ocrResult?.status || "ready";
  const isProcessing = status === "processing";
  const hasText = page.ocrResult?.text && page.ocrResult.text.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ backgroundColor: "#fef2f2", padding: "1rem", borderRadius: "8px", border: "1px solid #fca5a5" }}>
        <h3 style={{ margin: "0 0 0.5rem 0", color: "#991b1b" }}>OCR解析ページ</h3>
        
        <div style={{ backgroundColor: "white", padding: "1rem", borderRadius: "4px", marginBottom: "1rem" }}>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#374151" }}>
            <li><strong>対象ページ番号:</strong> {page.pageNumber}</li>
            <li><strong>判定理由:</strong> {page.classificationReason || "手動設定または不明"}</li>
            <li><strong>OCR送信状態:</strong> {status}</li>
            {page.ocrResult?.processingTime !== undefined && (
              <li><strong>処理時間:</strong> {(page.ocrResult.processingTime / 1000).toFixed(2)}秒</li>
            )}
            {page.ocrResult?.confidence !== undefined && (
              <li><strong>平均信頼度:</strong> {page.ocrResult.confidence.toFixed(1)}%</li>
            )}
            {page.ocrResult?.errorMessage && (
              <li style={{ color: "red" }}><strong>エラー:</strong> {page.ocrResult.errorMessage}</li>
            )}
          </ul>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button 
            className={styles.btn} 
            style={{ backgroundColor: "#ef4444", color: "white", border: "none" }}
            onClick={() => onRunOcr(page.pageNumber)}
            disabled={isProcessing}
          >
            {isProcessing ? "OCR解析中..." : "このページをOCR解析する"}
          </button>
          
          <button 
            className={styles.btn} 
            onClick={() => onToggleOcrTarget(page.pageNumber, false)}
            disabled={isProcessing}
          >
            OCR対象から外す
          </button>
        </div>
      </div>
      
      {hasText && (
        <div style={{ backgroundColor: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 0.5rem 0" }}>OCR抽出テキスト</h4>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: "0.9rem", color: "#334155" }}>
            {page.ocrResult?.text}
          </pre>
        </div>
      )}

      <OcrDebugPanel page={page} />
    </div>
  );
}

