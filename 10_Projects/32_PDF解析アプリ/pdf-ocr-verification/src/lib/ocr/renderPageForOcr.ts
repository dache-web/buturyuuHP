import type * as pdfjsLib from "pdfjs-dist";

export interface OcrRenderAttempt {
  methodName: string;
  renderIntent: string;
  hasBackground: boolean;
  canvasWidth: number;
  canvasHeight: number;
  nonWhitePixelRatio: number;
  sampledPixelCount: number;
  nonWhitePixelCount: number;
  dataUrl?: string;
}

export interface OcrRenderAttempt {
  methodName: string;
  renderIntent: string;
  hasBackground: boolean;
  canvasWidth: number;
  canvasHeight: number;
  nonWhitePixelRatio: number;
  sampledPixelCount: number;
  nonWhitePixelCount: number;
  dataUrl?: string;
}

export interface PdfInternalDebugInfo {
  pageNumber: number;
  operatorListLength: number;
  fnArrayLength: number;
  argsArrayLength: number;
  paintImageXObjectCount: number;
  paintInlineImageXObjectCount: number;
  hasPaintJpegXObject: boolean;
  imageMaskCount: number;
  solidColorImageMaskCount: number;
  beginGroupCount: number;
  formXObjectBeginCount: number;
  annotationBeginCount: number;
  markedContentBeginCount: number;
  setGStateCount: number;
  dependencyCount: number;
  annotationCount: number;
  transformIssues: string;
  pdfjsVersion: string;
  workerSrc: string;
  errorsAndWarnings: string;
  // 以下は app/page.tsx で注入される
  isSameDocument?: boolean;
  isSamePage?: boolean;
  leftViewport?: string;
  ocrViewport?: string;
}

export interface OcrDebugInfo {
  pageNumber: number;
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  renderScale: number;
  renderIntent: string;
  nonWhitePixelRatio: number;
  fallbackUsed: boolean;
  sampledPixelCount: number;
  nonWhitePixelCount: number;
  debugDataUrl: string;
  attempts?: OcrRenderAttempt[];
  internalDebugInfo?: PdfInternalDebugInfo;
}

export interface OcrImageResult {
  dataUrl: string;
  width: number;
  height: number;
  debugInfo?: OcrDebugInfo;
  failedAtRender?: boolean;
}

const WHITE_THRESHOLD = 250;
const ALPHA_THRESHOLD = 10;
const SAMPLING_STEP = 10;
const BLANK_RATIO_THRESHOLD = 0.001; // 0.1%以下なら白紙

function calculateNonWhitePixelRatio(context: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  let sampledPixelCount = 0;
  let nonWhitePixelCount = 0;
  
  for (let y = 0; y < height; y += SAMPLING_STEP) {
    for (let x = 0; x < width; x += SAMPLING_STEP) {
      sampledPixelCount++;
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a < ALPHA_THRESHOLD) continue;
      if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) continue;
      
      nonWhitePixelCount++;
    }
  }
  
  return {
    sampledPixelCount,
    nonWhitePixelCount,
    ratio: sampledPixelCount === 0 ? 0 : nonWhitePixelCount / sampledPixelCount
  };
}

export async function renderPageForOcr(
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number = 2.0
): Promise<OcrImageResult> {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const methods = [
    { name: "display", intent: "display", background: undefined },
    { name: "display + background:white", intent: "display", background: "rgba(255,255,255,1)" },
    { name: "print + background:white", intent: "print", background: "rgba(255,255,255,1)" },
  ];

  const attempts: OcrRenderAttempt[] = [];
  let successAttempt: OcrRenderAttempt | null = null;
  let finalDataUrl = "";
  let finalWidth = 0;
  let finalHeight = 0;

  for (const method of methods) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas context could not be created.");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    if (method.background) {
      context.fillStyle = method.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    const renderOptions: any = {
      canvasContext: context,
      viewport: viewport,
      intent: method.intent,
    };
    if (method.background) {
      renderOptions.background = method.background;
    }

    const renderTask = page.render(renderOptions);
    await renderTask.promise;

    const { sampledPixelCount, nonWhitePixelCount, ratio } = calculateNonWhitePixelRatio(context, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/png");

    const attemptInfo: OcrRenderAttempt = {
      methodName: method.name,
      renderIntent: method.intent,
      hasBackground: !!method.background,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      nonWhitePixelRatio: ratio,
      sampledPixelCount,
      nonWhitePixelCount,
      dataUrl: process.env.NODE_ENV === "development" ? dataUrl : undefined
    };
    attempts.push(attemptInfo);

    if (ratio > BLANK_RATIO_THRESHOLD) {
      successAttempt = attemptInfo;
      finalDataUrl = dataUrl;
      finalWidth = canvas.width;
      finalHeight = canvas.height;
      // Clean up for this successful canvas is not strictly necessary if we return the dataUrl, but we clear it to free memory
      canvas.width = 0;
      canvas.height = 0;
      break;
    } else {
      // 失敗した場合はクリーンアップして次のループへ
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  let internalDebugInfo: PdfInternalDebugInfo | undefined;

  if (!successAttempt) {
    // 全ての描画方式で白紙だった場合、内部構造を調査
    internalDebugInfo = await inspectPdfInternalStructure(page, viewport);
  }

  const debugInfo: OcrDebugInfo | undefined = {
    pageNumber,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    canvasWidth: finalWidth,
    canvasHeight: finalHeight,
    renderScale: scale,
    renderIntent: successAttempt ? successAttempt.renderIntent : "failed",
    nonWhitePixelRatio: successAttempt ? successAttempt.nonWhitePixelRatio : 0,
    fallbackUsed: successAttempt ? successAttempt.methodName !== "display" : false,
    sampledPixelCount: successAttempt ? successAttempt.sampledPixelCount : 0,
    nonWhitePixelCount: successAttempt ? successAttempt.nonWhitePixelCount : 0,
    debugDataUrl: finalDataUrl,
    attempts,
    internalDebugInfo
  };

  return { 
    dataUrl: finalDataUrl, 
    width: finalWidth, 
    height: finalHeight,
    debugInfo,
    failedAtRender: !successAttempt
  };
}

async function inspectPdfInternalStructure(page: pdfjsLib.PDFPageProxy, viewport: pdfjsLib.PageViewport): Promise<PdfInternalDebugInfo> {
  const info: any = {
    pageNumber: page.pageNumber,
    ocrViewport: `${viewport.width} x ${viewport.height}`,
    pdfjsVersion: (pdfjsLib as any).version || "unknown",
    workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc || "unknown",
  };

  try {
    const opList = await page.getOperatorList();
    info.operatorListLength = opList.fnArray.length;
    info.fnArrayLength = opList.fnArray.length;
    info.argsArrayLength = opList.argsArray.length;

    let paintImageXObjectCount = 0;
    let paintInlineImageXObjectCount = 0;
    let hasPaintJpegXObject = false;
    let imageMaskCount = 0;
    let solidColorImageMaskCount = 0;
    let beginGroupCount = 0;
    let formXObjectBeginCount = 0;
    let annotationBeginCount = 0;
    let markedContentBeginCount = 0;
    let setGStateCount = 0;

    let transformIssues = "";
    
    // ops mapping depends on pdfjs version. 
    const OPS = (pdfjsLib as any).OPS || (pdfjsLib as any).shared?.OPS || {
      paintImageXObject: 82,
      paintInlineImageXObject: 83,
      paintJpegXObject: 85,
      paintImageMaskXObject: 84,
      paintSolidColorImageMask: 86,
      beginGroup: 92,
      beginXObject: 95,
      paintFormXObjectBegin: 94, // 以前のバージョン等
      beginAnnotation: 93, // 適宜
      beginMarkedContent: 98,
      setGState: 3
    }; // fallback if undefined
    
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (OPS) {
        if (fn === OPS.paintImageXObject) paintImageXObjectCount++;
        if (fn === OPS.paintInlineImageXObject) paintInlineImageXObjectCount++;
        if (fn === OPS.paintJpegXObject) hasPaintJpegXObject = true;
        if (fn === OPS.paintImageMaskXObject) imageMaskCount++;
        if (fn === OPS.paintSolidColorImageMask) solidColorImageMaskCount++;
        if (fn === OPS.beginGroup) beginGroupCount++;
        if (fn === OPS.paintFormXObjectBegin || fn === OPS.beginXObject) formXObjectBeginCount++;
        if (fn === OPS.beginAnnotation) annotationBeginCount++;
        if (fn === OPS.beginMarkedContent) markedContentBeginCount++;
        if (fn === OPS.setGState) setGStateCount++;
        if (fn === OPS.transform) {
          if (args && args.some((a: any) => typeof a === 'number' && (isNaN(a) || !isFinite(a) || a === 0))) {
            transformIssues += `Index ${i}: [${args.join(',')}] `;
          }
        }
      }
    }

    info.paintImageXObjectCount = paintImageXObjectCount;
    info.paintInlineImageXObjectCount = paintInlineImageXObjectCount;
    info.hasPaintJpegXObject = hasPaintJpegXObject;
    info.imageMaskCount = imageMaskCount;
    info.solidColorImageMaskCount = solidColorImageMaskCount;
    info.beginGroupCount = beginGroupCount;
    info.formXObjectBeginCount = formXObjectBeginCount;
    info.annotationBeginCount = annotationBeginCount;
    info.markedContentBeginCount = markedContentBeginCount;
    info.setGStateCount = setGStateCount;
    
    info.dependencyCount = page.commonObjs ? Object.keys((page.commonObjs as any).objs || {}).length : 0; 

    const annots = await page.getAnnotations();
    info.annotationCount = annots.length;

    info.transformIssues = transformIssues || "None";
    info.errorsAndWarnings = "None"; 

  } catch (err: any) {
    info.errorsAndWarnings = err.toString();
  }

  return info as PdfInternalDebugInfo;
}
