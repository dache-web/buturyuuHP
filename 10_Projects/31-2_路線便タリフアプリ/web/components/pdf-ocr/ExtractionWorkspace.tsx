import React from "react";
import { ExtractionField } from "@/lib/pdf-ocr/gas/types";
import { ExtractionAssignment } from "@/types/pdf-ocr/extractionAssignment";
import ExtractionFieldList from "./ExtractionFieldList";
import ExtractionResultEditor from "./ExtractionResultEditor";
import SelectionToolbar from "./SelectionToolbar";

interface Props {
  fields: ExtractionField[];
  assignments: Record<string, ExtractionAssignment>;
  activeFieldId: string | null;
  setAssignments: React.Dispatch<React.SetStateAction<Record<string, ExtractionAssignment>>>;
  setActiveFieldId: React.Dispatch<React.SetStateAction<string | null>>;
  onPageSelect: (field: ExtractionField) => void;
  onMultiPageSelect: (field: ExtractionField, start: number, end: number) => void;
  onDocumentSelect: (field: ExtractionField) => void;
  onClearPdfSelection: () => void;
  onNudgeArea?: (deltaXpx: number, deltaYpx: number) => void;
  onReExtract?: () => void;
  onResetArea?: () => void;
}

export default function ExtractionWorkspace({
  fields,
  assignments,
  activeFieldId,
  setAssignments,
  setActiveFieldId,
  onPageSelect,
  onMultiPageSelect,
  onDocumentSelect,
  onClearPdfSelection,
  onNudgeArea,
  onReExtract,
  onResetArea
}: Props) {

  const activeField = fields.find(f => f.fieldId === activeFieldId) || null;
  const activeAssignment = activeFieldId ? assignments[activeFieldId] : undefined;

  const handleFieldSelect = (fieldId: string) => {
    setActiveFieldId(fieldId);
  };

  const handleUpdateEditedText = (text: string | null) => {
    if (!activeFieldId || !assignments[activeFieldId]) return;
    
    setAssignments(prev => {
      const current = prev[activeFieldId];
      return {
        ...prev,
        [activeFieldId]: {
          ...current,
          editedText: text,
          finalText: text !== null ? text : current.originalText,
          isConfirmed: false,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  const handleConfirm = () => {
    if (!activeFieldId || !assignments[activeFieldId]) return;
    
    setAssignments(prev => {
      const current = prev[activeFieldId];
      return {
        ...prev,
        [activeFieldId]: {
          ...current,
          isConfirmed: true,
          updatedAt: new Date().toISOString()
        }
      };
    });
  };

  const handleClear = () => {
    if (!activeFieldId) return;
    
    setAssignments(prev => {
      const newAssignments = { ...prev };
      delete newAssignments[activeFieldId];
      return newAssignments;
    });
    onClearPdfSelection();
  };

  const handleReSelect = () => {
    if (!activeFieldId || !assignments[activeFieldId]) return;
    
    setAssignments(prev => {
      const current = prev[activeFieldId];
      return {
        ...prev,
        [activeFieldId]: {
          ...current,
          selectedElementIds: [],
          selectionAreas: [],
          originalSelectionArea: null,
          actualReadArea: null,
          readOffset: null,
          originalText: "",
          editedText: null,
          finalText: "",
          isConfirmed: false,
          updatedAt: new Date().toISOString()
        }
      };
    });
    onClearPdfSelection();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ backgroundColor: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#334155" }}>抽出項目一覧</h3>
        <ExtractionFieldList 
          fields={fields} 
          assignments={assignments} 
          activeFieldId={activeFieldId || ""} 
          onFieldSelect={handleFieldSelect} 
        />
      </div>

      <SelectionToolbar 
        activeField={activeField} 
        onPageSelect={() => activeField && onPageSelect(activeField)}
        onMultiPageSelect={(s, e) => activeField && onMultiPageSelect(activeField, s, e)}
        onDocumentSelect={() => activeField && onDocumentSelect(activeField)}
      />

      <ExtractionResultEditor 
        activeField={activeField} 
        assignment={activeAssignment}
        onUpdateEditedText={handleUpdateEditedText}
        onConfirm={handleConfirm}
        onClear={handleClear}
        onReSelect={handleReSelect}
        onNudgeArea={onNudgeArea}
        onReExtract={onReExtract}
        onResetArea={onResetArea}
      />
    </div>
  );
}


