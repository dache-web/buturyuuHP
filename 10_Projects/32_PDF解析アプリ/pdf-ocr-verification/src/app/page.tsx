"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./page.module.css";
import dynamic from "next/dynamic";
import { PdfAnalysisData } from "@/types/pdfAnalysis";
import { getActiveResult } from "@/lib/pdf/activeResult";
import ExtractedTextPanel from "../components/ExtractedTextPanel";
import TextElementsPanel from "../components/TextElementsPanel";
import RuleConnectionPanel from "../components/RuleConnectionPanel";
import JsonPanel from "../components/JsonPanel";

import type * as pdfjsLib from "pdfjs-dist";

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
  const [activeTab, setActiveTab] = useState<"text" | "document" | "elements" | "json">("text");
  const [showOverlay, setShowOverlay] = useState(true);

  // Pagination state (shared between left and right)
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfNumPages, setPdfNumPages] = useState<number>(0);

  // Edited texts state
  const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});
  

  const pdfDocumentProxyRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabContentScrollRef = useRef<HTMLDivElement>(null);


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
    const newFileInfo = {
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + " MB",
      type: file.type,
      lastModified: new Date(file.lastModified).toLocaleString(),
    };
    setFileInfo(newFileInfo);
    
    // Start text extraction independently from PDF Viewer
    import("@/lib/pdf/extractText")
      .then(({ extractTextFromPdf }) => extractTextFromPdf(file))
      .then((data) => {
        setAnalysisData(data);
        setIsExtracting(false);
      })
      .catch((err) => {
        console.error("Text extraction failed", err);
        setExtractError("文字情報の取得に失敗しました。");
        setIsExtracting(false);
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


  const downloadJson = () => {
    if (!analysisData) return;
    
    const exportData = {
      ...analysisData,
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

  // 抽出操作（PdfViewerからのコールバック）
  const handleElementsSelected = useCallback((ids: string[]) => {
    if (ids.length > 0) {
      setSelectedElementId(ids[0]);
    } else {
      setSelectedElementId(null);
    }
  }, []);

  // Get current page elements for overlay
  const currentPageElements = (() => {
    const page = analysisData?.pages.find(p => p.pageNumber === pdfCurrentPage);
    if (!page) return [];
    return getActiveResult(page, editedTexts[pdfCurrentPage]).elements;
  })();

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1>PDF・OCR精度検証ツール</h1>
        <p>PDFの読み取り精度、文字座標、表解析を検証するためのツールです。</p>
      </header>

      {/* 新しく追加したルール接続確認領域 (GAS API) */}
      <RuleConnectionPanel />

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


          <div className={styles.layout}>
            {/* 左側: PDFプレビュー */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
            <PdfViewer 
              file={selectedFile} 
              onClear={handleClear}
              selectedElementIds={selectedElementId ? [selectedElementId] : []}
              onElementsSelected={handleElementsSelected}
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
                ページ全文
              </div>
              <div 
                className={`${styles.tab} ${activeTab === "document" ? styles.active : ""}`}
                onClick={() => setActiveTab("document")}
              >
                文書全文
              </div>
              <div 
                className={`${styles.tab} ${activeTab === "elements" ? styles.active : ""}`}
                onClick={() => setActiveTab("elements")}
              >
                文字要素
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
                <div className={styles.error}>{extractError}</div>
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
                    />
                  )}
                  {activeTab === "document" && (
                    <div>
                      <h3>文書全文</h3>
                      <pre style={{ whiteSpace: "pre-wrap", background: "var(--card-bg)", padding: "1rem", borderRadius: "8px" }}>
                        {analysisData.pages.map(p => p.finalText).join("\n\n---\n\n")}
                      </pre>
                    </div>
                  )}
                  {activeTab === "elements" && <TextElementsPanel data={analysisData} currentPage={pdfCurrentPage} selectedElementId={selectedElementId} onElementClick={setSelectedElementId} />}
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
