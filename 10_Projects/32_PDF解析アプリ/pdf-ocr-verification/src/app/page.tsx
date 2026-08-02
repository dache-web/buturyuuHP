"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./page.module.css";
import dynamic from "next/dynamic";
import { PdfAnalysisData } from "@/types/pdfAnalysis";
import { getActiveResult } from "@/lib/pdf/activeResult";
import ExtractedTextPanel from "../components/ExtractedTextPanel";
import TextElementsPanel from "../components/TextElementsPanel";
import JsonPanel from "../components/JsonPanel";
import * as pdfjsLib from "pdfjs-dist";

const PdfViewer = dynamic(() => import("../components/PdfViewer"), { ssr: false });

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{name: string, size: string, type: string, lastModified: string} | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  
  // Analysis state
  const [analysisData, setAnalysisData] = useState<PdfAnalysisData | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"text" | "elements" | "table" | "json">("text");
  const [showOverlay, setShowOverlay] = useState(true);

  // Pagination state (shared between left and right)
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfNumPages, setPdfNumPages] = useState<number>(0);

  // Edited texts state
  const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});

  // OCR state
  const [isOcring, setIsOcring] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<{ current: number; total: number; currentPageNum: number; completed: number; failed: number } | null>(null);
  const [ocrConfigured, setOcrConfigured] = useState<boolean | null>(null);
  const [ocrMissingSettings, setOcrMissingSettings] = useState<string[]>([]);
  
  const pdfDocumentProxyRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabContentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_OCR !== 'true') {
      setOcrConfigured(false);
      return;
    }

    fetch("/api/ocr/status")
      .then(res => res.json())
      .then(data => {
        setOcrConfigured(data.configured);
        setOcrMissingSettings(data.missingSettings || []);
      })
      .catch(err => {
        console.error("Failed to fetch OCR status", err);
        setOcrConfigured(false);
      });
  }, []);

  const validateAndSetFile = (file: File) => {
    setFileError(null);
    setSelectedFile(null);
    setFileInfo(null);
    setAnalysisData(null);
    setExtractError(null);
    setIsExtracting(false);
    setSelectedElementId(null);
    setPdfCurrentPage(1);
    setPdfNumPages(0);
    setEditedTexts({}); // Clear edits on new file

    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFileError("PDFファイルを選択してください。");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size === 0) {
      setFileError("ファイルの内容がありません。");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError("ファイルサイズが上限の50MBを超えています。");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setIsExtracting(true);
    setFileInfo({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + " MB",
      type: file.type,
      lastModified: new Date(file.lastModified).toLocaleString(),
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!selectedFile) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (selectedFile) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setFileInfo(null);
    setFileError(null);
    setAnalysisData(null);
    setExtractError(null);
    setIsExtracting(false);
    setSelectedElementId(null);
    setPdfCurrentPage(1);
    setPdfNumPages(0);
    setEditedTexts({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExtractSuccess = useCallback((data: PdfAnalysisData) => {
    setAnalysisData(data);
    setIsExtracting(false);
  }, []);

  const handleExtractError = useCallback((errorStr: string) => {
    setExtractError(errorStr);
    setIsExtracting(false);
  }, []);

  const handleDocumentLoad = useCallback((numPages: number) => {
    setPdfNumPages(numPages);
  }, []);

  const handlePdfLoaded = useCallback((pdf: pdfjsLib.PDFDocumentProxy) => {
    pdfDocumentProxyRef.current = pdf;
  }, []);

  const handlePageChange = useCallback((page: number) => {
    if (page !== pdfCurrentPage) {
      setPdfCurrentPage(page);
      setSelectedElementId(null); // Clear selected element on page change
    }
  }, [pdfCurrentPage]);

  // Reset scroll position on page or tab change
  useEffect(() => {
    if (tabContentScrollRef.current) {
      tabContentScrollRef.current.scrollTop = 0;
    }
  }, [pdfCurrentPage, activeTab]);

  const runOcrForPages = async (pageNumbers: number[]) => {
    if (!analysisData || !pdfDocumentProxyRef.current || pageNumbers.length === 0) return;
    
    if (ocrConfigured === false) {
      alert("Google Document AIが未設定です。\nOCRを実行するには環境設定が必要です。\n不足している設定:\n" + ocrMissingSettings.join("\n"));
      return;
    }
    
    setIsOcring(true);
    let completed = 0;
    let failed = 0;
    
    for (let i = 0; i < pageNumbers.length; i++) {
      const pageNum = pageNumbers[i];
      setOcrProgress({
        current: i + 1,
        total: pageNumbers.length,
        currentPageNum: pageNum,
        completed,
        failed
      });

      setAnalysisData(prev => {
        if (!prev) return prev;
        const newData = { ...prev };
        const pageIdx = newData.pages.findIndex(p => p.pageNumber === pageNum);
        if (pageIdx !== -1) {
          const newPage = { ...newData.pages[pageIdx] };
          newPage.ocrResult = { ...newPage.ocrResult, status: "processing" };
          newData.pages[pageIdx] = newPage;
        }
        return newData;
      });

      try {
        const { renderPageToImageBase64 } = await import("@/lib/pdf/renderToImage");
        const imageBase64 = await renderPageToImageBase64(pdfDocumentProxyRef.current, pageNum);

        const res = await fetch("/api/ocr/page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: selectedFile?.name,
            pageNumber: pageNum,
            imageBase64,
            provider: "google_document_ai"
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `OCR API failed: ${res.statusText}`);
        }

        const ocrResponse = await res.json();
        
        setAnalysisData(prev => {
          if (!prev) return prev;
          const newData = { ...prev };
          const pageIdx = newData.pages.findIndex(p => p.pageNumber === pageNum);
          if (pageIdx !== -1) {
            const newPage = { ...newData.pages[pageIdx] };
            newPage.ocrResult = {
              ...newPage.ocrResult,
              ...ocrResponse.ocrResult,
              status: "success"
            };
            const active = getActiveResult(newPage, editedTexts[pageNum]);
            newPage.finalText = active.finalText;
            newData.pages[pageIdx] = newPage;
          }
          return newData;
        });
        completed++;
      } catch (err: unknown) {
        console.error("OCR failed for page", pageNum, err);
        failed++;
        setAnalysisData(prev => {
          if (!prev) return prev;
          const newData = { ...prev };
          const pageIdx = newData.pages.findIndex(p => p.pageNumber === pageNum);
          if (pageIdx !== -1) {
            const newPage = { ...newData.pages[pageIdx] };
            newPage.ocrResult = {
              ...newPage.ocrResult,
              status: "failed",
              error: err instanceof Error ? err.message : String(err)
            };
            const active = getActiveResult(newPage, editedTexts[pageNum]);
            newPage.finalText = active.finalText;
            newData.pages[pageIdx] = newPage;
          }
          return newData;
        });
      }
    }
    
    setAnalysisData(prev => {
      if (!prev) return prev;
      const newData = { ...prev };
      newData.document = {
        ...newData.document,
        ocrCompletedPages: (newData.document.ocrCompletedPages || 0) + completed,
        ocrFailedPages: (newData.document.ocrFailedPages || 0) + failed,
      };
      return newData;
    });

    setIsOcring(false);
    setOcrProgress(null);
  };

  const downloadJson = () => {
    if (!analysisData) return;
    
    const exportData = {
      ...analysisData,
      ocrEnabled: process.env.NEXT_PUBLIC_ENABLE_OCR === 'true',
      pages: analysisData.pages.map(page => {
        const active = getActiveResult(page, editedTexts[page.pageNumber]);
        return {
          ...page,
          originalText: page.pdfTextResult?.text || "",
          editedText: editedTexts[page.pageNumber] || null,
          isEdited: editedTexts[page.pageNumber] !== undefined,
          finalText: active.finalText,
          // Replace root text with finalText to ensure backwards compatibility with simple parsers
          text: active.finalText,
        };
      })
    };
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Create filename based on original file name
    const originalName = fileInfo?.name.replace(/\.pdf$/i, "") || "document";
    link.download = `${originalName}_analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadText = () => {
    if (!analysisData) return;
    
    const textChunks: string[] = [];
    analysisData.pages.forEach(page => {
      textChunks.push(`===== Page ${page.pageNumber} =====\n`);
      const active = getActiveResult(page, editedTexts[page.pageNumber]);
      textChunks.push(active.finalText + "\n\n");
    });
    
    const blob = new Blob([textChunks.join("")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const originalName = fileInfo?.name.replace(/\.pdf$/i, "") || "document";
    link.download = `${originalName}_text.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Get current page elements for overlay
  const currentPageElements = (() => {
    const page = analysisData?.pages.find(p => p.pageNumber === pdfCurrentPage);
    if (!page) return [];
    return getActiveResult(page, editedTexts[pdfCurrentPage]).elements;
  })();

  const pagesNeedingOcr = analysisData?.pages.filter(p => p.requiresOcr && p.ocrResult?.status !== 'success').map(p => p.pageNumber) || [];

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1>PDF・OCR精度検証ツール</h1>
        <p>PDFの読み取り精度、文字座標、表解析を検証するためのツールです。</p>
      </header>

      {fileError && (
        <div className={styles.error}>
          {fileError}
        </div>
      )}

      {!selectedFile && (
        <section 
          className={`${styles.uploadArea} ${selectedFile ? styles.disabled : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ borderColor: isDragging ? 'var(--primary-color)' : '' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className={styles.uploadIcon}>📄</div>
          <p className={styles.uploadText}>PDFファイルをドラッグ＆ドロップ</p>
          <p className={styles.uploadSubtext}>またはクリックしてファイルを選択</p>
          <input 
            type="file" 
            accept="application/pdf,.pdf" 
            onChange={handleFileSelect}
            ref={fileInputRef}
          />
        </section>
      )}

      {fileInfo && (
        <section className={styles.infoCard}>
          <h2>選択したPDFの情報</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>ファイル名</span>
              <span className={styles.infoValue}>{fileInfo.name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>ファイルサイズ</span>
              <span className={styles.infoValue}>{fileInfo.size}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>MIMEタイプ</span>
              <span className={styles.infoValue}>{fileInfo.type || "application/pdf"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>選択日時</span>
              <span className={styles.infoValue}>{fileInfo.lastModified}</span>
            </div>
          </div>
          {!selectedFile && (
             <div className={styles.buttonGroup}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClear}>
                選択解除
              </button>
            </div>
          )}
        </section>
      )}

      {selectedFile && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
          {process.env.NEXT_PUBLIC_ENABLE_OCR === 'true' && pagesNeedingOcr.length > 0 && !isOcring && (
            <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#991b1b', fontWeight: 'bold' }}>
                {pagesNeedingOcr.length}ページでOCR処理が必要です。（対象ページ: {pagesNeedingOcr.join(', ')}）
              </p>
              {ocrConfigured === false ? (
                <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem' }}>
                  現在OCRサービス（Google Document AI）が未設定のため、解析できません。環境設定をご確認ください。
                </p>
              ) : (
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => runOcrForPages(pagesNeedingOcr)}>
                  OCR必要ページを解析
                </button>
              )}
            </div>
          )}
          
          {isOcring && ocrProgress && (
            <div style={{ padding: '1rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#1d4ed8', fontWeight: 'bold' }}>
                OCR処理中... ({ocrProgress.current} / {ocrProgress.total} ページ完了)
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#3b82f6' }}>
                現在：{ocrProgress.currentPageNum}ページ目
                (成功: {ocrProgress.completed}, 失敗: {ocrProgress.failed})
              </p>
            </div>
          )}

          <div className={styles.layout}>
            {/* 左側: PDFプレビュー */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
            <PdfViewer 
              file={selectedFile} 
              onClear={handleClear}
              onExtractSuccess={handleExtractSuccess}
              onExtractError={handleExtractError}
              selectedElementId={selectedElementId}
              onElementClick={setSelectedElementId}
              showOverlay={showOverlay}
              pageElements={currentPageElements}
              currentPage={pdfCurrentPage}
              onPageChange={handlePageChange}
              onDocumentLoad={handleDocumentLoad}
              onPdfLoaded={handlePdfLoaded}
            />
          </div>

          {/* 右側: 抽出結果タブ */}
          <div className={styles.tabsSection}>
            <div className={styles.tabList}>
              <div 
                className={`${styles.tab} ${activeTab === "text" ? styles.active : ""}`}
                onClick={() => setActiveTab("text")}
              >
                抽出テキスト
              </div>
              <div 
                className={`${styles.tab} ${activeTab === "elements" ? styles.active : ""}`}
                onClick={() => setActiveTab("elements")}
              >
                文字要素
              </div>
              <div 
                className={`${styles.tab} ${activeTab === "table" ? styles.active : ""}`}
                onClick={() => setActiveTab("table")}
              >
                表
              </div>
              <div 
                className={`${styles.tab} ${activeTab === "json" ? styles.active : ""}`}
                onClick={() => setActiveTab("json")}
              >
                生JSON
              </div>
            </div>
            
            <div className={styles.tabContent} ref={tabContentScrollRef}>
              {isExtracting ? (
                <p>ページ {pdfCurrentPage} の解析結果を準備しています……</p>
              ) : extractError ? (
                <div className={styles.error}>PDFは表示できましたが、文字情報を取得できませんでした。<br/>{extractError}</div>
              ) : analysisData ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem", flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button 
                        className={styles.btn} 
                        onClick={() => handlePageChange(pdfCurrentPage - 1)}
                        disabled={pdfCurrentPage <= 1}
                      >
                        前へ
                      </button>
                      <span>ページ {pdfCurrentPage} / {pdfNumPages || '?'}</span>
                      <button 
                        className={styles.btn} 
                        onClick={() => handlePageChange(pdfCurrentPage + 1)}
                        disabled={pdfCurrentPage >= pdfNumPages}
                      >
                        次へ
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="checkbox" 
                          checked={showOverlay} 
                          onChange={(e) => setShowOverlay(e.target.checked)} 
                        />
                        文字枠を表示
                      </label>
                      <button className={styles.btn} onClick={downloadText}>全文テキスト</button>
                      <button className={styles.btn} onClick={downloadJson}>文書全体JSON</button>
                    </div>
                  </div>
                  
                  {activeTab === "text" && (
                    <ExtractedTextPanel 
                      data={analysisData} 
                      currentPage={pdfCurrentPage} 
                      editedText={editedTexts[pdfCurrentPage]}
                      onEditText={(text) => setEditedTexts(prev => ({ ...prev, [pdfCurrentPage]: text }))}
                      onResetText={() => setEditedTexts(prev => { 
                        const newObj = { ...prev }; 
                        delete newObj[pdfCurrentPage]; 
                        return newObj; 
                      })}
                      onRunOcr={(pageNum) => runOcrForPages([pageNum])}
                    />
                  )}
                  {activeTab === "elements" && <TextElementsPanel data={analysisData} currentPage={pdfCurrentPage} selectedElementId={selectedElementId} onElementClick={setSelectedElementId} />}
                  {activeTab === "table" && <p>ページ {pdfCurrentPage} の表解析は後工程で実装します。</p>}
                  {activeTab === "json" && <JsonPanel data={analysisData} currentPage={pdfCurrentPage} editedTexts={editedTexts} />}
                </>
              ) : (
                <p>解析結果はありません。</p>
              )}
            </div>
          </div>
        </div>
        </div>
      )}
    </main>
  );
}
