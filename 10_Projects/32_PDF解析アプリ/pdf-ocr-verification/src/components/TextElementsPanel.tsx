import { useEffect, useRef } from "react";
import { PdfAnalysisData, TextElement } from "@/types/pdfAnalysis";
import { getActiveResult } from "@/lib/pdf/activeResult";
import styles from "../app/page.module.css";

interface Props {
  data: PdfAnalysisData;
  currentPage: number;
  selectedElementId: string | null;
  onElementClick: (id: string) => void;
}

export default function TextElementsPanel({ data, currentPage, selectedElementId, onElementClick }: Props) {
  // Extract elements for the current page
  const pageData = data.pages.find(p => p.pageNumber === currentPage);
  const elements = pageData ? getActiveResult(pageData).elements : [];

  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Scroll to selected element when it changes
  useEffect(() => {
    if (selectedElementId) {
      const row = rowRefs.current.get(selectedElementId);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedElementId]);

  return (
    <div className={styles.panelContent}>
      <h3 className={styles.stickyHeader}>ページ {currentPage} の文字要素 ({elements.length}件)</h3>
      
      {elements.length === 0 ? (
        <p className={styles.noText}>このページには文字要素がありません。</p>
      ) : (
        <div className={styles.elementListTableContainer}>
          <table className={styles.elementTable}>
            <thead>
              <tr>
                <th>読順</th>
                <th>文字列</th>
                <th>信頼度</th>
                <th>X</th>
                <th>Y</th>
                <th>W</th>
                <th>H</th>
                <th>改行</th>
                <th>フォント</th>
              </tr>
            </thead>
            <tbody>
              {elements.map((el: TextElement) => {
                let rowClass = '';
                if (selectedElementId === el.id) {
                  rowClass = styles.selectedRow;
                }
                
                let confidenceStyle = {};
                let confidenceText = "-";
                
                if (el.confidence !== undefined && el.confidence !== null) {
                  confidenceText = `${Math.round(el.confidence * 100)}%`;
                  if (el.confidence < 0.7) {
                    confidenceStyle = { backgroundColor: '#fee2e2', color: '#991b1b' }; // Red for < 70%
                  } else if (el.confidence < 0.9) {
                    confidenceStyle = { backgroundColor: '#fef3c7', color: '#92400e' }; // Yellow for < 90%
                  }
                }

                return (
                  <tr 
                    key={el.id} 
                    ref={(element) => {
                      if (element) {
                        rowRefs.current.set(el.id, element);
                      } else {
                        rowRefs.current.delete(el.id);
                      }
                    }}
                    className={rowClass}
                    style={selectedElementId === el.id ? {} : confidenceStyle}
                    onClick={() => onElementClick(el.id)}
                  >
                    <td>{el.readingOrder}</td>
                    <td className={styles.textCell} title={el.text}>{el.text}</td>
                    <td>{confidenceText}</td>
                    <td>{el.normalizedCoordinates.x.toFixed(4)}</td>
                    <td>{el.normalizedCoordinates.y.toFixed(4)}</td>
                    <td>{el.normalizedCoordinates.width.toFixed(4)}</td>
                    <td>{el.normalizedCoordinates.height.toFixed(4)}</td>
                    <td>{el.hasEOL ? "✓" : ""}</td>
                    <td className={styles.fontCell} title={el.fontName}>{el.fontName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
