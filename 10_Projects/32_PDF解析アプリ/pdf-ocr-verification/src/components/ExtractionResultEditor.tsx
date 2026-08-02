import React, { useState, useEffect } from "react";
import { ExtractionField } from "@/lib/gas/types";
import { ExtractionAssignment } from "@/types/extractionAssignment";
import { formatValue } from "@/lib/extraction/formatValue";

interface Props {
  activeField: ExtractionField | null;
  assignment: ExtractionAssignment | undefined;
  onUpdateEditedText: (text: string | null) => void;
  onConfirm: () => void;
  onClear: () => void;
  onReSelect: () => void;
}

export default function ExtractionResultEditor({ activeField, assignment, onUpdateEditedText, onConfirm, onClear, onReSelect }: Props) {
  const [localText, setLocalText] = useState("");

  useEffect(() => {
    if (assignment) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalText(assignment.editedText !== null ? assignment.editedText : assignment.finalText);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalText("");
    }
  }, [assignment]);

  if (!activeField) {
    return <div style={{ padding: "1rem", color: "#64748b", fontSize: "0.9rem" }}>先に抽出項目を選択してください。</div>;
  }

  const isAssigned = !!assignment && assignment.originalText !== "";
  
  // 自動整形値のプレビュー
  const formattedPreview = isAssigned ? formatValue(assignment.originalText, activeField.dataType) : "";

  return (
    <div style={{ backgroundColor: "white", padding: "1rem", border: "1px solid #cbd5e1", borderRadius: "4px" }}>
      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "#334155" }}>
        現在の抽出項目: <span style={{ color: "#2563eb" }}>{activeField.fieldName}</span>
      </h4>
      <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 1rem 0" }}>
        選択方法: {activeField.selectionMethod} {activeField.allowMultiple ? "(複数可)" : "(単一)"}
      </p>

      {!isAssigned ? (
        <div style={{ padding: "1rem", backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "4px", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}>
          PDF上の文字枠をクリックまたはドラッグして選択してください。<br/>
          （選択方法に沿った操作のみ可能です）
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", color: "#64748b", marginBottom: "0.25rem" }}>抽出元の文字 (自動整形: {activeField.dataType})</label>
            <div style={{ fontSize: "0.9rem", padding: "0.5rem", backgroundColor: "#f1f5f9", borderRadius: "4px", border: "1px solid #e2e8f0", whiteSpace: "pre-wrap" }}>
              {formattedPreview || <span style={{ color: "#94a3b8" }}>(空)</span>}
            </div>
            {formattedPreview !== assignment.originalText && (
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                ※生データ: {assignment.originalText}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", color: "#64748b", marginBottom: "0.25rem" }}>最終結果 (編集可能)</label>
            <textarea 
              value={localText}
              onChange={(e) => {
                setLocalText(e.target.value);
                onUpdateEditedText(e.target.value);
              }}
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.9rem", minHeight: "80px", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button 
              onClick={onConfirm}
              style={{ padding: "0.4rem 1rem", backgroundColor: assignment.isConfirmed ? "#16a34a" : "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            >
              {assignment.isConfirmed ? "確定済み (再確定)" : "確定"}
            </button>
            <button 
              onClick={() => onUpdateEditedText(null)}
              disabled={
                assignment.editedText === null ||
                assignment.editedText === undefined ||
                assignment.editedText === assignment.originalText
              }
              style={{ padding: "0.4rem 1rem", backgroundColor: "white", border: "1px solid #cbd5e1", color: "#475569", borderRadius: "4px", cursor: (assignment.editedText === null || assignment.editedText === undefined || assignment.editedText === assignment.originalText) ? "not-allowed" : "pointer" }}
            >
              元に戻す
            </button>
            <button 
              onClick={onReSelect}
              style={{ padding: "0.4rem 1rem", backgroundColor: "white", border: "1px solid #cbd5e1", color: "#475569", borderRadius: "4px", cursor: "pointer" }}
            >
              選び直す
            </button>
            <button 
              onClick={onClear}
              style={{ padding: "0.4rem 1rem", backgroundColor: "white", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: "4px", cursor: "pointer", marginLeft: "auto" }}
            >
              クリア
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
