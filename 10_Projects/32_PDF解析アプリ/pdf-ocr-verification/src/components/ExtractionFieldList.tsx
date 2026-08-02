import React from "react";
import { ExtractionField } from "@/lib/gas/types";
import { ExtractionAssignment } from "@/types/extractionAssignment";

interface Props {
  fields: ExtractionField[];
  assignments: Record<string, ExtractionAssignment>;
  activeFieldId: string;
  onFieldSelect: (fieldId: string) => void;
}

export default function ExtractionFieldList({ fields, assignments, activeFieldId, onFieldSelect }: Props) {
  if (fields.length === 0) {
    return <p style={{ fontSize: "0.85rem", color: "#64748b" }}>項目がありません。</p>;
  }

  const getStatusLabel = (fieldId: string) => {
    const assignment = assignments[fieldId];
    if (!assignment) return { label: "未選択", color: "#94a3b8" };
    if (assignment.isConfirmed) return { label: "確定済み", color: "#16a34a" };
    if (assignment.editedText !== null) return { label: "修正済み", color: "#f59e0b" };
    if (assignment.originalText) return { label: "入力済み", color: "#2563eb" };
    return { label: "選択中", color: "#0ea5e9" }; // 選択状態だけど文字列がない場合（通常はない）
  };

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "400px", overflowY: "auto" }}>
      {fields.map(field => {
        const isActive = field.fieldId === activeFieldId;
        const status = getStatusLabel(field.fieldId);
        const isError = field.isRequired && status.label === "未選択";

        return (
          <li 
            key={field.fieldId} 
            onClick={() => onFieldSelect(field.fieldId)}
            style={{ 
              backgroundColor: isActive ? "#eff6ff" : "white", 
              padding: "0.75rem", 
              border: `2px solid ${isActive ? "#3b82f6" : "#cbd5e1"}`, 
              borderRadius: "4px", 
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
              <div style={{ fontWeight: "bold", color: "#334155" }}>
                {field.fieldName} {field.isRequired && <span style={{ color: "#ef4444", fontSize: "0.8rem" }}>*必須</span>}
              </div>
              <span style={{ fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "4px", backgroundColor: `${status.color}20`, color: status.color, border: `1px solid ${status.color}40` }}>
                {status.label}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.25rem" }}>{field.description}</div>
            
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
              <span style={{ backgroundColor: "#f1f5f9", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.75rem" }}>選択: {field.selectionMethod}</span>
              <span style={{ backgroundColor: "#f1f5f9", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.75rem" }}>単位: {field.extractionUnit}</span>
              <span style={{ backgroundColor: "#f1f5f9", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.75rem" }}>型: {field.dataType}</span>
              {field.allowMultiple && <span style={{ backgroundColor: "#dbeafe", color: "#1e40af", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.75rem" }}>複数選択可 ({field.joinMethod})</span>}
            </div>

            {isError && !isActive && <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem" }}>未入力です</div>}
          </li>
        );
      })}
    </ul>
  );
}
