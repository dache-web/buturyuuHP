import { PdfAnalysisData, PageAnalysis, PageType } from "@/types/pdfAnalysis";
import { analyzeTable } from "./tableAnalysis";

export async function classifyPages(
  file: File,
  analysisData: PdfAnalysisData
): Promise<PdfAnalysisData> {
  if (typeof window === "undefined") {
    throw new Error("Page classification must run in the browser.");
  }
  
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.debug.mjs';
  }

  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDocument = await loadingTask.promise;
  
  try {
    const updatedPages = await Promise.all(
      analysisData.pages.map(async (page): Promise<PageAnalysis> => {
        try {
          const pdfPage = await pdfDocument.getPage(page.pageNumber);
          const opList = await pdfPage.getOperatorList();
          
          let hasImageOperators = false;
          for (let i = 0; i < opList.fnArray.length; i++) {
            const fn = opList.fnArray[i];
            // OPS.paintImageXObject (82), OPS.paintJpegXObject (83), OPS.paintImageMaskXObject (84)
            if (
              fn === pdfjsLib.OPS.paintImageXObject ||
              // @ts-expect-error - paintJpegXObject may not be typed in this version
              fn === pdfjsLib.OPS.paintJpegXObject ||
              fn === pdfjsLib.OPS.paintImageMaskXObject ||
              fn === 83 || fn === 85 // Fallback to raw constants if needed
            ) {
              hasImageOperators = true;
              break;
            }
          }
          
          const hasPdfText = page.pdfTextResult.elementCount > 0;
          const canvasRenderSucceeded = true; // Assuming success if getOperatorList succeeds
          
          let basePageType: PageType = "unknown";
          let reason = "";
          
          if (hasPdfText && !hasImageOperators) {
            basePageType = "text";
            reason = "文字あり・画像命令なし";
          } else if (hasPdfText && hasImageOperators) {
            basePageType = "mixed";
            reason = "文字あり・画像命令あり";
          } else if (!hasPdfText && hasImageOperators) {
            basePageType = "image";
            reason = "文字なし・画像命令あり";
          } else if (!hasPdfText && !hasImageOperators) {
            basePageType = "blank";
            reason = "文字なし・画像命令なし";
          }
          
          let finalPageType: PageType = basePageType;
          let tableResult = undefined;
          
          if (basePageType === "text" || basePageType === "mixed") {
            const tableAnalysis = analyzeTable(page.pageNumber, page.pdfTextResult.elements);
            if (tableAnalysis.isTableCandidate) {
              finalPageType = "table_candidate";
              tableResult = tableAnalysis.tableResult;
              reason += "（さらに表候補の条件を満たしました）";
            }
          }
          
          return {
            ...page,
            hasPdfText,
            hasImageOperators,
            canvasRenderSucceeded,
            classificationReason: reason,
            pageType: finalPageType,
            tableResult,
            ocrResult: finalPageType === "image" ? { status: "ready", pageNumber: page.pageNumber } : { status: "not_required", pageNumber: page.pageNumber }
          };
        } catch (err) {
          console.error(`Error classifying page ${page.pageNumber}:`, err);
          return {
            ...page,
            pageType: "unknown",
            classificationReason: "分類処理中にエラー発生",
            ocrResult: { status: "not_required", pageNumber: page.pageNumber }
          };
        }
      })
    );
    
    return {
      ...analysisData,
      pages: updatedPages
    };
  } finally {
    if (loadingTask && typeof loadingTask.destroy === "function") {
      await loadingTask.destroy();
    }
  }
}
