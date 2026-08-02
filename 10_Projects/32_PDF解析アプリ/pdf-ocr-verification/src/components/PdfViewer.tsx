"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type * as pdfjsLib from "pdfjs-dist";
import styles from "../app/page.module.css";
import { TextElement } from "@/types/pdfAnalysis";

interface PdfViewerProps {
  file: File;
  onClear: () => void;
  selectedElementIds?: string[];
  onElementsSelected?: (ids: string[]) => void;
  showOverlay?: boolean;
  pageElements?: TextElement[];
  currentPage: number;
  onPageChange?: (page: number) => void;
  onDocumentLoad?: (numPages: number) => void;
  onPdfLoaded?: (pdf: pdfjsLib.PDFDocumentProxy) => void;
}

type FitMode = "width" | "page" | "none";

export default function PdfViewer({ 
  file, 
  onClear, 
  selectedElementIds = [],
  onElementsSelected,
  showOverlay = true,
  pageElements = [],
  currentPage,
  onPageChange,
  onDocumentLoad,
  onPdfLoaded
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  
  const [error, setError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Track overlay state internally to react to size changes
  const [canvasSize, setCanvasSize] = useState<{width: number, height: number} | null>(null);


  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const pdfDocumentRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  
  // Use refs for callbacks to avoid dependency cycles
  const onDocumentLoadRef = useRef(onDocumentLoad);
  const onPdfLoadedRef = useRef(onPdfLoaded);
  
  useEffect(() => {
    onDocumentLoadRef.current = onDocumentLoad;
    onPdfLoadedRef.current = onPdfLoaded;
  }, [onDocumentLoad, onPdfLoaded]);

  // 1. PDFファイル読込処理とテキスト抽出
  useEffect(() => {
    if (!file) return;

    let cancelled = false;

    const loadPdf = async () => {
      console.log("PDF LOAD START");
      setLoading(true);
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // ヘッダーチェック
        const uint8Array = new Uint8Array(arrayBuffer.slice(0, 5));
        const header = new TextDecoder().decode(uint8Array);
        if (header !== "%PDF-") {
          throw new Error("Invalid PDF header.");
        }

        const data = new Uint8Array(arrayBuffer);
        
        const pdfjsLib = await import("pdfjs-dist");
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        }
        
        const loadingTask = pdfjsLib.getDocument({ data });
        loadingTaskRef.current = loadingTask;
        
        const pdf = await loadingTask.promise;
        
        if (cancelled) return;
        
        pdfDocumentRef.current = pdf;
        setNumPages(pdf.numPages);
        setPdfReady(true);
        console.log("PDF LOAD COMPLETE");
        
        if (onDocumentLoadRef.current) {
          onDocumentLoadRef.current(pdf.numPages);
        }
        
        if (onPdfLoadedRef.current) {
          onPdfLoadedRef.current(pdf);
        }

      } catch (err: unknown) {
        console.error("Error loading PDF:", err);
        if (!cancelled) {
          setError("PDFを読み込めませんでした。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      if (loadingTaskRef.current && typeof loadingTaskRef.current.destroy === "function") {
        console.log("DESTROYING OLD PDF DOCUMENT");
        loadingTaskRef.current.destroy();
      }
      loadingTaskRef.current = null;
      pdfDocumentRef.current = null;
    };
  }, [file]);

  // renderPage の単純化
  const renderPage = useCallback(async () => {
    const pdf = pdfDocumentRef.current;
    const canvas = canvasRef.current;

    if (!pdf || !canvas) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
      console.log("PDF RENDER CANCEL");
    }

    console.log("CANVAS READY");
    console.log("INITIAL RENDER START");

    try {
      const page = await pdf.getPage(currentPage);
      
      let currentScale = scale;
      if (fitMode === "width") {
        if (containerRef.current) {
          // Adjust for scrollbar width approx 20px
          const containerWidth = containerRef.current.clientWidth - 24; 
          const defaultViewport = page.getViewport({ scale: 1.0 });
          currentScale = containerWidth / defaultViewport.width;
        }
      } else if (fitMode === "page") {
        if (containerRef.current) {
          const containerWidth = containerRef.current.clientWidth - 24;
          const containerHeight = containerRef.current.clientHeight - 24;
          const defaultViewport = page.getViewport({ scale: 1.0 });
          const scaleW = containerWidth / defaultViewport.width;
          const scaleH = containerHeight / defaultViewport.height;
          currentScale = Math.min(scaleW, scaleH);
        }
      }

      const viewport = page.getViewport({ scale: currentScale });
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      renderTaskRef.current = renderTask;

      await renderTask.promise;
      console.log("INITIAL RENDER COMPLETE");
      
      // Update canvas size for overlays
      setCanvasSize({ width: canvas.width, height: canvas.height });
      
    } catch (error) {
      if (error instanceof Error && error.name === "RenderingCancelledException") {
        return;
      }
      throw error;
    } finally {
      if (renderTaskRef.current !== null) {
        renderTaskRef.current = null;
      }
    }
  }, [currentPage, scale, fitMode]);

  // 2. ページ描画処理
  useEffect(() => {
    if (pdfReady) {
      // Wait for layout to settle, specifically for containerRef.clientWidth to be non-zero
      const timer = requestAnimationFrame(() => {
        void renderPage();
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [currentPage, scale, fitMode, pdfReady, renderPage]);

  // スクロール位置のリセット
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      containerRef.current.scrollLeft = 0;
    }
  }, [currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages && onPageChange) {
      onPageChange(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setFitMode("none");
    setScale(prev => prev * 1.2);
  };
  
  const handleZoomOut = () => {
    setFitMode("none");
    setScale(prev => prev / 1.2);
  };
  
  const handleFitWidth = () => {
    setFitMode("width");
  };
  
  const handleFitPage = () => {
    setFitMode("page");
  };
  
  const handleResetZoom = () => {
    setFitMode("none");
    setScale(1.0);
  };

  const handleElementClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (onElementsSelected) {
      onElementsSelected([id]);
    }
  };

  // 常に一番外側の viewerSection を返すことで、DOMツリーの破壊を防ぎ、removeChildエラーを回避する
  return (
    <div className={styles.viewerSection}>
      {error ? (
        <div className={styles.error}>{error}</div>
      ) : loading || !pdfReady ? (
        <p>PDFを読み込んでいます...</p>
      ) : (
        <>
          <div className={styles.viewerToolbar}>
            <div className={styles.toolbarGroup}>
              <button 
                className={styles.btn} 
                onClick={handlePrevPage} 
                disabled={currentPage <= 1}
              >
                前へ
              </button>
              <span>{currentPage} / {numPages}</span>
              <button 
                className={styles.btn} 
                onClick={handleNextPage} 
                disabled={currentPage >= numPages}
              >
                次へ
              </button>
            </div>
            
            <div className={styles.toolbarGroup}>
              <button className={styles.btn} onClick={handleZoomOut}>縮小</button>
              <span>{fitMode === "width" ? "横幅" : fitMode === "page" ? "全体" : `${Math.round(scale * 100)}%`}</span>
              <button className={styles.btn} onClick={handleZoomIn}>拡大</button>
              <button className={styles.btn} onClick={handleFitWidth}>横幅に合わせる</button>
              <button className={styles.btn} onClick={handleFitPage}>ページ全体を表示</button>
              <button className={styles.btn} onClick={handleResetZoom}>100%表示</button>
            </div>
            
            <div>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClear}>選択解除</button>
            </div>
          </div>

          <div className={styles.pdfScrollContainer} ref={containerRef}>
            <div 
              className={styles.canvasWrapper}
            >
              <canvas ref={canvasRef} className={styles.canvas}></canvas>
              
              {/* Overlay rendering */}
              {showOverlay && canvasSize && pageElements.length > 0 && (
                <div 
                  className={styles.overlayContainer} 
                >
                  {pageElements.map(el => {
                    const { x, y, width, height } = el.normalizedCoordinates;
                    const isSelected = selectedElementIds.includes(el.id);
                    
                    return (
                      <div
                        key={el.id}
                        className={`${styles.textOverlayBox} ${isSelected ? styles.selectedOverlay : ''} ${styles.clickableOverlay}`}
                        style={{
                          left: `${x * 100}%`,
                          top: `${y * 100}%`,
                          width: `${width * 100}%`,
                          height: `${height * 100}%`,
                        }}
                        onClick={(e) => handleElementClick(el.id, e)}
                        title={el.text}
                      />
                    );
                  })}
                  

                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
