import { PdfAnalysisData } from "@/types/pdfAnalysis";
import styles from "../app/page.module.css";
import { getActiveResult } from "@/lib/pdf/activeResult";

interface Props {
  data: PdfAnalysisData;
  currentPage: number;
  editedText?: string;
  onEditText: (text: string) => void;
  onResetText: () => void;
  onRunOcr?: (pageNum: number) => void;
}

export default function ExtractedTextPanel({ data, currentPage, editedText, onEditText, onResetText, onRunOcr }: Props) {
  const page = data.pages.find(p => p.pageNumber === currentPage);
  const documentType = data.document.documentType;

  if (!page) {
    return <div className={styles.panelContent}>ページのデータがありません。</div>;
  }

  const isEdited = editedText !== undefined;
  const active = getActiveResult(page, editedText);
  const displayText = active.finalText;
  
  const isOcr = active.method === "ocr";
  const elementCount = active.elements.length;
  const textLength = active.text.length;
  const averageConfidence = isOcr ? page.ocrResult?.averageConfidence : null;
  
  const ocrDisabled = page.ocrResult?.status === "disabled";

  let analysisMethodText = isOcr ? "OCR" : "PDF内部文字を直接取得";
  if (ocrDisabled && page.requiresOcr) {
    analysisMethodText = "画像ページ・文字抽出対象外";
  }

  return (
    <div className={styles.panelContent}>
      {/* 文書全体の警告 (OCR有効時のみ) */}
      {!ocrDisabled && documentType === "mixed_pdf" && (
        <div className={styles.warningAlert} style={{ borderColor: '#f59e0b', backgroundColor: '#fef3c7', color: '#b45309' }}>
          <strong>文書全体：</strong> このPDFには、文字を直接取得できるページと、OCRが必要な画像ページが混在しています。
        </div>
      )}
      {!ocrDisabled && documentType === "scanned_pdf" && (
        <div className={styles.warningAlert} style={{ borderColor: '#ef4444', backgroundColor: '#fef2f2', color: '#b91c1c' }}>
          <strong>文書全体：</strong> このPDFの全ページで、取得可能な文字情報がほとんどありません。OCR処理が必要です。
        </div>
      )}

      {/* ページ単位の警告・案内 */}
      {ocrDisabled && page.requiresOcr && (
        <div className={styles.warningAlert} style={{ borderColor: '#93c5fd', backgroundColor: '#eff6ff', color: '#1e3a8a' }}>
          このページにはPDF内部の文字情報がありません。画像として保存されている可能性があります。OCR機能は現在保留中です。
        </div>
      )}

      {!ocrDisabled && page.requiresOcr && page.ocrResult?.status !== 'success' && (
        <div className={styles.warningAlert}>
          このページにはPDF内部の文字情報がほとんどありません。画像またはスキャンページの可能性があります。このページはOCR処理が必要です。
        </div>
      )}
      
      {!ocrDisabled && page.ocrResult?.status === 'failed' && (
        <div className={styles.warningAlert} style={{ borderColor: '#ef4444', backgroundColor: '#fef2f2', color: '#b91c1c' }}>
          <strong>OCR処理失敗：</strong> {page.ocrResult.error || "不明なエラーが発生しました。"}
          <br/>
          PDF内部の抽出結果を表示しています。
          {onRunOcr && (
            <div style={{ marginTop: '0.5rem' }}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onRunOcr(page.pageNumber)}>
                設定を確認してOCR再実行
              </button>
            </div>
          )}
        </div>
      )}

      <div className={styles.pageItem}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', padding: '0.8rem', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9rem' }}>
            <div><strong>解析方法：</strong> {analysisMethodText}</div>
            {!ocrDisabled && isOcr && page.ocrResult?.provider && <div><strong>OCRサービス：</strong> {page.ocrResult.provider === 'google_document_ai' ? 'Google Document AI' : page.ocrResult.provider}</div>}
            {!ocrDisabled && isOcr && averageConfidence !== undefined && averageConfidence !== null && (
              <div><strong>平均信頼度：</strong> {Math.round(averageConfidence * 100)}％</div>
            )}
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
              {!ocrDisabled && isOcr && onRunOcr && (
                <button className={styles.btn} onClick={() => onRunOcr(page.pageNumber)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
                  OCR再実行
                </button>
              )}
            </div>
          </div>
        </div>
        
        {page.requiresOcr && page.ocrResult?.status !== 'success' && (
          <p style={{ fontSize: '0.85rem', color: '#b45309', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            PDF内部の文字情報はありません。{ocrDisabled ? 'OCR機能は保留中ですが、手動で入力できます。' : 'OCR処理に失敗した場合でも、手動入力できます。'}
          </p>
        )}
        
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
