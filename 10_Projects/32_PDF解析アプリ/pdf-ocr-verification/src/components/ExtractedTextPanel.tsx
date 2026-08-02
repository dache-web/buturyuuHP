import { PdfAnalysisData } from "@/types/pdfAnalysis";
import styles from "../app/page.module.css";
import { getActiveResult } from "@/lib/pdf/activeResult";

interface Props {
  data: PdfAnalysisData;
  currentPage: number;
  editedText?: string;
  onEditText: (text: string) => void;
  onResetText: () => void;
}

export default function ExtractedTextPanel({ data, currentPage, editedText, onEditText, onResetText }: Props) {
  const page = data.pages.find(p => p.pageNumber === currentPage);

  if (!page) {
    return <div className={styles.panelContent}>ページのデータがありません。</div>;
  }

  const isEdited = editedText !== undefined;
  const active = getActiveResult(page, editedText);
  const displayText = active.finalText;
  
  const elementCount = active.elements.length;
  const textLength = active.text.length;

  return (
    <div className={styles.panelContent}>
      {page.pageType === "image_page" && (
        <div className={styles.warningAlert} style={{ borderColor: '#93c5fd', backgroundColor: '#eff6ff', color: '#1e3a8a' }}>
          このページにはPDF内部の文字情報がありません。画像として保存されている可能性があります。
        </div>
      )}

      <div className={styles.pageItem}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', padding: '0.8rem', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9rem' }}>
            <div><strong>解析方法：</strong> PDF内部文字を直接取得</div>
            <div><strong>処理時間：</strong> {page.processingTimeMs}ms</div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.9rem' }}>
              抽出要素数: {elementCount}件 | 元の文字数: {textLength}文字
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={`${styles.editStatus} ${isEdited ? styles.statusEdited : styles.statusUnchanged}`}>
                {isEdited ? "修正済み" : "未修正"}
              </span>
            </div>
          </div>
        </div>
        
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          ※この編集は出力用テキストを修正します。PDF上の文字枠や座標付き文字要素は変更されません。
        </p>
        
        <div className={styles.extractedText}>
          <textarea
            className={styles.editTextarea}
            value={displayText}
            onChange={(e) => onEditText(e.target.value)}
            placeholder="テキストが見つかりません"
          />
        </div>
        
        <div className={styles.editToolbar}>
          {isEdited && (
            <button className={styles.btn} onClick={onResetText}>
              元の入力内容に戻す
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
