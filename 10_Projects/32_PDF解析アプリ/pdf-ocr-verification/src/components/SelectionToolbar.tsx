import React, { useState } from "react";
import { ExtractionField } from "@/lib/gas/types";

interface Props {
  activeField: ExtractionField | null;
  onPageSelect: () => void;
  onMultiPageSelect: (start: number, end: number) => void;
  onDocumentSelect: () => void;
}

export default function SelectionToolbar({ activeField, onPageSelect, onMultiPageSelect, onDocumentSelect }: Props) {
  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("2");

  if (!activeField) return null;

  const method = activeField.selectionMethod;

  if (method === "page") {
    return (
      <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f1f5f9", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
        <p style={{ fontSize: "0.85rem", margin: "0 0 0.5rem 0", color: "#475569" }}>この項目は現在表示しているページ全体の文字を取得します。</p>
        <button 
          onClick={onPageSelect}
          style={{ padding: "0.5rem 1rem", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
          現在ページを選択
        </button>
      </div>
    );
  }

  if (method === "multi_page") {
    return (
      <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f1f5f9", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
        <p style={{ fontSize: "0.85rem", margin: "0 0 0.5rem 0", color: "#475569" }}>指定範囲のページ全文を取得して結合します。</p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input 
            type="number" 
            min="1" 
            value={startPage} 
            onChange={e => setStartPage(e.target.value)} 
            style={{ width: "60px", padding: "0.25rem" }} 
          />
          <span>〜</span>
          <input 
            type="number" 
            min="1" 
            value={endPage} 
            onChange={e => setEndPage(e.target.value)} 
            style={{ width: "60px", padding: "0.25rem" }} 
          />
          <button 
            onClick={() => onMultiPageSelect(Number(startPage), Number(endPage))}
            style={{ padding: "0.4rem 1rem", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
          >
            適用
          </button>
        </div>
      </div>
    );
  }

  if (method === "document") {
    return (
      <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f1f5f9", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
        <p style={{ fontSize: "0.85rem", margin: "0 0 0.5rem 0", color: "#475569" }}>PDF文書全体の文字を取得します。</p>
        <button 
          onClick={onDocumentSelect}
          style={{ padding: "0.5rem 1rem", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
          文書全文を選択
        </button>
      </div>
    );
  }

  return null;
}
