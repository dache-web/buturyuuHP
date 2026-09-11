"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type * as pdfjsLib from "pdfjs-dist";
import styles from "@/app/pdf-verify/page.module.css";
import { TextElement } from "@/types/pdf-ocr/pdfAnalysis";
import { ExtractionAssignment, SelectionArea } from "@/types/pdf-ocr/extractionAssignment";
import { FieldRegionItem } from "@/types/pdf-ocr/fieldRegion";
import { getPdfjsOptions, getWorkerSrc } from '@/lib/pdf-ocr/pdf/pdfjsConfig';

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
  activeAssignment?: ExtractionAssignment;
  otherAssignedElementIds?: string[];
  onSelectionRectangle?: (area: SelectionArea) => void;
  fieldRegions?: FieldRegionItem[];
  activeFieldRegion?: FieldRegionItem | null;
  onFieldRegionSelection?: (area: SelectionArea) => void;
  onActualReadAreaChange?: (newArea: SelectionArea) => void;
  onReExtractRequested?: () => void;
}

type FitMode = "auto" | "width" | "page" | "none";

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
  onPdfLoaded,
  activeAssignment,
  otherAssignedElementIds = [],
  onSelectionRectangle,
  fieldRegions = [],
  activeFieldRegion = null,
  onFieldRegionSelection,
  onActualReadAreaChange,
  onReExtractRequested
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<FitMode>("auto");
  
  const [error, setError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Track overlay state internally to react to size changes
  const [canvasSize, setCanvasSize] = useState<{width: number, height: number} | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{x: number, y: number} | null>(null);

  // POINT B3: 赤い読取枠のドラッグ移動State
  const [isDraggingRedBox, setIsDraggingRedBox] = useState(false);
  const [redBoxDragStart, setRedBoxDragStart] = useState<{ x: number; y: number; initialX: number; initialY: number } | null>(null);
  const [tempRedBoxArea, setTempRedBoxArea] = useState<SelectionArea | null>(null);

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
          pdfjsLib.GlobalWorkerOptions.workerSrc = getWorkerSrc(pdfjsLib.version);
        }
        
        const loadingTask = pdfjsLib.getDocument({
          data,
          ...getPdfjsOptions(pdfjsLib.version),
        });
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
      
      const defaultViewport = page.getViewport({ scale: 1.0 });

      let currentScale = scale;
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 20;
        const containerHeight = containerRef.current.clientHeight - 20;
        const widthScale = containerWidth / defaultViewport.width;
        const heightScale = containerHeight / defaultViewport.height;
        const fitPageScale = Math.min(widthScale, heightScale);

        if (fitMode === "auto") {
          const isPortrait = defaultViewport.height > defaultViewport.width;
          currentScale = fitPageScale;

          if (isPortrait) {
            const targetReadableScale = widthScale * 0.68;
            const maxComfortScale = Math.min(widthScale * 0.76, heightScale * 1.15);
            currentScale = Math.max(fitPageScale, Math.min(targetReadableScale, maxComfortScale));
          }
        } else if (fitMode === "width") {
          currentScale = containerWidth / defaultViewport.width;
        } else if (fitMode === "page") {
          currentScale = fitPageScale;
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
  
  const handleFitPage = () => {
    setFitMode("page");
  };

  const handleAutoFit = () => {
    setFitMode("auto");
  };
  
  const handleResetZoom = () => {
    setFitMode("none");
    setScale(1.0);
  };

  const handleElementClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Disable clicking for OCR elements for now
    if (id.startsWith('ocr_')) return;

    if (onElementsSelected) {
      onElementsSelected([id]);
    }
  };

  const handleRedBoxMouseDown = (e: React.MouseEvent<HTMLDivElement>, currentArea: SelectionArea) => {
    e.stopPropagation();
    setIsDraggingRedBox(true);
    if (containerRef.current) {
      setRedBoxDragStart({
        x: e.clientX,
        y: e.clientY,
        initialX: currentArea.x,
        initialY: currentArea.y,
      });
      setTempRedBoxArea(currentArea);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRedBox) return;
    if (!onSelectionRectangle && !onFieldRegionSelection) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setIsDragging(true);
    setDragStart({ x, y });
    setDragCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRedBox && redBoxDragStart && tempRedBoxArea && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = (e.clientX - redBoxDragStart.x) / rect.width;
      const deltaY = (e.clientY - redBoxDragStart.y) / rect.height;
      const newX = Math.max(0, Math.min(1 - tempRedBoxArea.width, redBoxDragStart.initialX + deltaX));
      const newY = Math.max(0, Math.min(1 - tempRedBoxArea.height, redBoxDragStart.initialY + deltaY));
      
      const updatedArea = {
        ...tempRedBoxArea,
        x: newX,
        y: newY,
      };
      setTempRedBoxArea(updatedArea);
      if (onActualReadAreaChange) {
        onActualReadAreaChange(updatedArea);
      }
      return;
    }

    if (!isDragging || !dragStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDragCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (isDraggingRedBox) {
      if (tempRedBoxArea && onActualReadAreaChange) {
        onActualReadAreaChange(tempRedBoxArea);
      }
      if (onReExtractRequested) {
        onReExtractRequested();
      }
      setIsDraggingRedBox(false);
      setRedBoxDragStart(null);
      setTempRedBoxArea(null);
      return;
    }

    if (isDragging && dragStart && dragCurrent) {
      let x = Math.min(dragStart.x, dragCurrent.x);
      let y = Math.min(dragStart.y, dragCurrent.y);
      let width = Math.abs(dragCurrent.x - dragStart.x);
      let height = Math.abs(dragCurrent.y - dragStart.y);

      if (onFieldRegionSelection && activeFieldRegion?.type === "single" && width <= 0.01 && height <= 0.01) {
        width = 0.08;
        height = 0.03;
        x = Math.max(0, Math.min(1 - width, dragStart.x - width / 2));
        y = Math.max(0, Math.min(1 - height, dragStart.y - height / 2));
      }

      if (width > 0.01 && height > 0.01) {
        if (onFieldRegionSelection) {
          onFieldRegionSelection({ pageNumber: currentPage, x, y, width, height });
        } else if (onSelectionRectangle) {
          onSelectionRectangle({ pageNumber: currentPage, x, y, width, height });
        }
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const currentPageFieldRegions = fieldRegions.filter(
    (field) => field.area?.pageNumber === currentPage
  );
  const canSelectArea = Boolean(onFieldRegionSelection || onSelectionRectangle);

  // POINT B3 枠データ抽出
  const originalBox = activeAssignment?.originalSelectionArea || activeAssignment?.selectionAreas?.[0];
  const actualBox = tempRedBoxArea || activeAssignment?.actualReadArea || originalBox;
  const isOriginalOnCurrentPage = originalBox && originalBox.pageNumber === currentPage;
  const isActualOnCurrentPage = actualBox && actualBox.pageNumber === currentPage;

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
              <button className={styles.btn} onClick={handleZoomOut}>-</button>
              <span>{fitMode === "auto" ? "自動" : fitMode === "width" ? "横幅" : fitMode === "page" ? "全体" : Math.round(scale * 100) + "%"}</span>
              <button className={styles.btn} onClick={handleZoomIn}>+</button>
              <button className={styles.btn} onClick={handleAutoFit}>自動</button>
              <button className={styles.btn} onClick={handleFitPage}>全体</button>
              <button className={styles.btn} onClick={handleResetZoom}>100%</button>
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
              {canvasSize && ((showOverlay && pageElements.length > 0) || currentPageFieldRegions.length > 0 || canSelectArea || isDragging || isOriginalOnCurrentPage || isActualOnCurrentPage) && (
                <div 
                  className={styles.overlayContainer} 
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{ cursor: canSelectArea ? 'crosshair' : 'default', pointerEvents: canSelectArea ? 'auto' : 'none' }}
                >
                  {/* C. 取得した文字 (最終採用されたTextElementの小枠 - activeAssignment または activeFieldRegion由受) */}
                  {showOverlay && pageElements.map(el => {
                    const { x, y, width, height } = el.normalizedCoordinates;
                    const isAssignmentSelected = activeAssignment?.selectedElementIds?.includes(el.id) || selectedElementIds.includes(el.id);
                    const isRegionSelected = activeFieldRegion?.textElementIds?.includes(el.id);
                    const isSelected = isAssignmentSelected || isRegionSelected;
                    const isOtherAssigned = otherAssignedElementIds.includes(el.id);
                    
                    if (!isSelected && !isOtherAssigned) return null;

                    return (
                      <div
                        key={el.id}
                        style={{
                          position: 'absolute',
                          left: `${x * 100}%`,
                          top: `${y * 100}%`,
                          width: `${width * 100}%`,
                          height: `${height * 100}%`,
                          border: isSelected ? '1.5px solid #dc2626' : '1px dashed #64748b',
                          backgroundColor: isSelected ? 'rgba(220, 38, 38, 0.35)' : 'rgba(100, 116, 139, 0.2)',
                          zIndex: isSelected ? 110 : 80,
                          pointerEvents: 'auto',
                          boxSizing: 'border-box'
                        }}
                        onClick={(e) => handleElementClick(el.id, e)}
                        title={isSelected ? `取得した文字: ${el.text}` : el.text}
                      />
                    );
                  })}

                  {/* A. 指定した範囲 (青枠) - activeAssignment または FieldRegionItem 由来 */}
                  {isOriginalOnCurrentPage && originalBox && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${originalBox.x * 100}%`,
                        top: `${originalBox.y * 100}%`,
                        width: `${originalBox.width * 100}%`,
                        height: `${originalBox.height * 100}%`,
                        border: '2px dashed #2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.12)',
                        pointerEvents: 'none',
                        zIndex: 90,
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: '-22px',
                          left: '0px',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          fontSize: '11px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          whiteSpace: 'nowrap',
                          fontWeight: 'bold',
                        }}
                      >
                        指定した範囲
                      </span>
                    </div>
                  )}

                  {/* B. 実際の読取範囲 (赤枠/オレンジ枠 - ドラッグ移動可) - activeAssignment または FieldRegionItem 由来 */}
                  {isActualOnCurrentPage && actualBox && (
                    <div
                      onMouseDown={(e) => handleRedBoxMouseDown(e, actualBox)}
                      style={{
                        position: 'absolute',
                        left: `${actualBox.x * 100}%`,
                        top: `${actualBox.y * 100}%`,
                        width: `${actualBox.width * 100}%`,
                        height: `${actualBox.height * 100}%`,
                        border: '2.5px solid #ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.22)',
                        cursor: 'grab',
                        pointerEvents: 'auto',
                        zIndex: 100,
                        boxSizing: 'border-box',
                      }}
                      title="ドラッグして読取範囲を移動"
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: '-22px',
                          right: '0px',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          fontSize: '11px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          whiteSpace: 'nowrap',
                          fontWeight: 'bold',
                        }}
                      >
                        実際の読取範囲 (ドラッグ移動可)
                      </span>
                    </div>
                  )}

                  {currentPageFieldRegions.map(field => {
                    if (!field.area) return null;
                    const origArea = field.originalArea || field.area;
                    const actArea = tempRedBoxArea || field.actualArea || field.area;
                    const isActive = field.id === activeFieldRegion?.id;

                    return (
                      <div key={field.id}>
                        {/* POINT B4: 囲み枠の直上へ「取得全文吹き出しカード (取得量付)」を表示 */}
                        {field.sourceText && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${actArea.x * 100}%`,
                              top: `calc(${actArea.y * 100}% - 48px)`,
                              minWidth: '240px',
                              maxWidth: '400px',
                              maxHeight: '120px',
                              backgroundColor: '#ffffff',
                              border: '1.5px solid #2563eb',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
                              zIndex: 130,
                              fontSize: '11px',
                              color: '#1e293b',
                              pointerEvents: 'auto',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div style={{ fontWeight: 'bold', color: '#2563eb', marginBottom: '2px', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>取得: {field.name}</span>
                              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>
                                文字要素: {field.elementCount ?? field.textElementIds?.length ?? 0}件 | {field.textLength ?? field.sourceText.length}文字
                              </span>
                            </div>
                            <div style={{ wordBreak: 'break-all', lineHeight: '1.3' }}>
                              {field.sourceText}
                            </div>
                          </div>
                        )}

                        {/* 領域設定 青枠 */}
                        {isActive && origArea && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${origArea.x * 100}%`,
                              top: `${origArea.y * 100}%`,
                              width: `${origArea.width * 100}%`,
                              height: `${origArea.height * 100}%`,
                              border: '2px dashed #2563eb',
                              backgroundColor: 'rgba(37, 99, 235, 0.12)',
                              pointerEvents: 'none',
                              zIndex: 90,
                              boxSizing: 'border-box',
                            }}
                          >
                            <span style={{ position: 'absolute', top: '-20px', left: '0px', backgroundColor: '#2563eb', color: '#fff', fontSize: '10px', padding: '1px 4px', borderRadius: '2px' }}>
                              指定した範囲
                            </span>
                          </div>
                        )}

                        {/* 領域設定 赤枠 (移動可能) */}
                        <div
                          className={`${styles.fieldRegionOverlay} ${isActive ? styles.activeFieldRegionOverlay : ""}`}
                          onMouseDown={isActive ? (e) => handleRedBoxMouseDown(e, { pageNumber: currentPage, x: actArea.x, y: actArea.y, width: actArea.width, height: actArea.height }) : undefined}
                          style={{
                            left: `${actArea.x * 100}%`,
                            top: `${actArea.y * 100}%`,
                            width: `${actArea.width * 100}%`,
                            height: `${actArea.height * 100}%`,
                            borderColor: isActive ? '#ef4444' : field.color,
                            borderWidth: isActive ? '2.5px' : '1.5px',
                            backgroundColor: isActive ? 'rgba(239, 68, 68, 0.22)' : `${field.color}33`,
                            cursor: isActive ? 'grab' : 'pointer',
                            zIndex: isActive ? 100 : 70,
                          }}
                          title={field.name}
                        >
                          <span style={{ backgroundColor: isActive ? '#ef4444' : field.color }}>
                            {field.name} {isActive ? "(実際の読取範囲)" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {isDragging && dragStart && dragCurrent && (
                    <div 
                      style={{
                        position: 'absolute',
                        left: `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
                        top: `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
                        width: `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
                        height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        border: '2px solid rgba(59, 130, 246, 0.8)',
                        pointerEvents: 'none',
                        zIndex: 100
                      }}
                    />
                  )}

                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


