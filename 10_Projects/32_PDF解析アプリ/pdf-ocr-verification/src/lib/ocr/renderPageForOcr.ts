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

export interface ImageXObjectInfo {
  index: number;
  imageName: string;
  width: number | string;
  height: number | string;
  hasImageMask: boolean;
  hasSMask: boolean;
  prevTransform: number[];
  currentTransform: number[];
  clipRects: string[];
  finalX: number;
  finalY: number;
  finalW: number;
  finalH: number;
  viewportX: number;
  viewportY: number;
  viewportW: number;
  viewportH: number;
  insideCanvasStatus: "INSIDE" | "PARTIAL" | "OUTSIDE" | "INVALID";
  issues: string[];
}

export interface TransformSummary {
  total: number;
  hasIssues: number;
  nanCount: number;
  infinityCount: number;
  outsideCanvasCount: number;
  negativeSizeCount: number;
  extremeScaleCount: number;
}

export interface JpegXObjectInfo {
  index: number;
  argsStr: string;
  objectId: string;
  exists: boolean;
  constructorName: string;
  width: number | string;
  height: number | string;
  hasData: boolean;
  hasBitmap: boolean;
  hasSrc: boolean;
  status: string;
  error: string;
  contextBefore: string[];
  contextAfter: string[];
}

export interface JpegObjectResolutionInfo {
  index: number;
  objectId: string;
  objsHas: boolean;
  objsGetSuccess: boolean;
  commonObjsHas: boolean;
  commonObjsGetSuccess: boolean;
  constructorName: string;
  width: number | string;
  height: number | string;
  hasBitmap: boolean;
  hasData: boolean;
  hasImageData: boolean;
  hasSrc: boolean;
  error: string;
}

export interface CanvasLifecycleInfo {
  displayBeforeW: number;
  displayBeforeH: number;
  displayAfterW: number;
  displayAfterH: number;
  backgroundBeforeW: number;
  backgroundBeforeH: number;
  backgroundAfterW: number;
  backgroundAfterH: number;
  printBeforeW: number;
  printBeforeH: number;
  printAfterW: number;
  printAfterH: number;
}

export interface RenderTimelineEntry {
  stage: string;
  timeMs: number;
  objsHas: boolean;
  objsGet: boolean;
  commonObjsHas: boolean;
  commonObjsGet: boolean;
}

export interface FreshDocumentComparison {
  existingCanvasW: number;
  existingCanvasH: number;
  existingRatio: number;
  existingOpCount: number;
  existingPaintJpegCount: number;
  
  freshCanvasW: number;
  freshCanvasH: number;
  freshRatio: number;
  freshOpCount: number;
  freshPaintJpegCount: number;
  
  freshObjsHasBefore: boolean;
  freshObjsGetBefore: boolean;
  freshObjsHasAfter: boolean;
  freshObjsGetAfter: boolean;
  freshRenderError: string;
}

export interface JpegDecodeError {
  objectId: string;
  errorMessage: string;
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
  imageXObjectsDetails?: ImageXObjectInfo[];
  transformSummary?: TransformSummary;
  viewerScale?: number;
  ocrScale?: number;
  viewerRotation?: number;
  ocrRotation?: number;
  viewerViewportWidth?: number;
  viewerViewportHeight?: number;
  ocrViewportWidth?: number;
  ocrViewportHeight?: number;
  jpegXObjectsDetails?: JpegXObjectInfo[];
  jpegObjectResolutionDetails?: JpegObjectResolutionInfo[];
  canvasLifecycle?: CanvasLifecycleInfo;
  renderTimeline?: RenderTimelineEntry[];
  freshComparison?: FreshDocumentComparison;
  jpegDecodeErrors?: JpegDecodeError[];
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
    // { name: "print + background:white", intent: "print", background: "rgba(255,255,255,1)" }, // 除外
  ];

  const attempts: OcrRenderAttempt[] = [];
  let successAttempt: OcrRenderAttempt | null = null;
  let finalDataUrl = "";
  let finalWidth = 0;
  let finalHeight = 0;

  const canvasLifecycle: CanvasLifecycleInfo = {
    displayBeforeW: 0, displayBeforeH: 0,
    displayAfterW: 0, displayAfterH: 0,
    backgroundBeforeW: 0, backgroundBeforeH: 0,
    backgroundAfterW: 0, backgroundAfterH: 0,
    printBeforeW: 0, printBeforeH: 0,
    printAfterW: 0, printAfterH: 0,
  };

  const renderTimeline: RenderTimelineEntry[] = [];
  const jpegDecodeErrors: JpegDecodeError[] = [];
  
  // ==========================================
  // Fresh Document Comparison
  // ==========================================
  let freshComparison: FreshDocumentComparison | undefined;
  try {
    const pdfjsLib = await import("pdfjs-dist");
    
    // Existing values (will be overwritten by loop but we take initial estimates)
    let existingOpCount = 0;
    let existingPaintJpegCount = 0;
    try {
      const opList = await page.getOperatorList();
      existingOpCount = opList.fnArray.length;
      for (const fn of opList.fnArray) {
        if (fn === 85) existingPaintJpegCount++;
      }
    } catch(_) {}

    const data = await pdfDocument.getData();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
    const freshDoc = await loadingTask.promise;
    const freshPage = await freshDoc.getPage(pageNumber);
    const freshViewport = freshPage.getViewport({ scale });
    
    const freshCanvas = document.createElement("canvas");
    const freshCtx = freshCanvas.getContext("2d", { willReadFrequently: true })!;
    freshCanvas.width = Math.floor(freshViewport.width);
    freshCanvas.height = Math.floor(freshViewport.height);
    
    const freshOpList = await freshPage.getOperatorList();
    let freshPaintJpegCount = 0;
    let targetObjId: string | null = null;
    for (let i = 0; i < freshOpList.fnArray.length; i++) {
      if (freshOpList.fnArray[i] === 85) {
        freshPaintJpegCount++;
        if (!targetObjId && freshOpList.argsArray[i] && freshOpList.argsArray[i].length > 0) {
          targetObjId = freshOpList.argsArray[i][0];
        }
      }
    }
    
    const getHasGet = () => {
      let has = false, get = false;
      if (targetObjId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageAny = freshPage as any;
        if (pageAny.objs) {
          has = !!pageAny.objs.has(targetObjId);
          if (has && pageAny.objs.get(targetObjId)) get = true;
        }
      }
      return { has, get };
    };

    let freshRenderError = "None";
    let objsHasBefore = false, objsGetBefore = false;
    let objsHasAfter = false, objsGetAfter = false;
    
    let originalWarn: typeof console.warn | undefined;
    try {
      originalWarn = console.warn;
      console.warn = (...args) => {
        if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Unable to decode image')) {
          const msg = args.join(' ');
          const match = msg.match(/Unable to decode image "([^"]+)": "(.*)"/);
          if (match) {
            jpegDecodeErrors.push({
              objectId: match[1],
              errorMessage: match[2]
            });
          } else {
            jpegDecodeErrors.push({
              objectId: 'Unknown',
              errorMessage: msg
            });
          }
        }
        if (originalWarn) {
          originalWarn.apply(console, args);
        }
      };

      const beforeState = getHasGet();
      objsHasBefore = beforeState.has;
      objsGetBefore = beforeState.get;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const freshRenderOptions: any = {
        canvasContext: freshCtx,
        viewport: freshViewport,
        intent: "display"
      };
      const renderTask = freshPage.render(freshRenderOptions);
      await renderTask.promise;
      
      const afterState = getHasGet();
      objsHasAfter = afterState.has;
      objsGetAfter = afterState.get;
    } catch(e: unknown) {
      freshRenderError = e instanceof Error ? e.toString() : String(e);
    } finally {
      if (originalWarn) {
        console.warn = originalWarn;
      }
    }
    
    const { ratio: freshRatio } = calculateNonWhitePixelRatio(freshCtx, freshCanvas.width, freshCanvas.height);
    
    freshComparison = {
      existingCanvasW: canvasLifecycle.displayBeforeW || Math.floor(viewport.width),
      existingCanvasH: canvasLifecycle.displayBeforeH || Math.floor(viewport.height),
      existingRatio: 0, // Will be updated later
      existingOpCount,
      existingPaintJpegCount,
      
      freshCanvasW: freshCanvas.width,
      freshCanvasH: freshCanvas.height,
      freshRatio,
      freshOpCount: freshOpList.fnArray.length,
      freshPaintJpegCount,
      
      freshObjsHasBefore: objsHasBefore,
      freshObjsGetBefore: objsGetBefore,
      freshObjsHasAfter: objsHasAfter,
      freshObjsGetAfter: objsGetAfter,
      freshRenderError
    };
    if ('destroy' in freshDoc) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (freshDoc as any).destroy();
    }
  } catch(e: unknown) {
    console.error("Fresh Document Comparison Failed:", e);
  }
  // ==========================================

  let targetObjectId: string | null = null;
  try {
    const opList = await page.getOperatorList();
    // 85 is paintJpegXObject
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] === 85 && opList.argsArray[i] && opList.argsArray[i].length > 0) {
        targetObjectId = opList.argsArray[i][0];
        break;
      }
    }
  } catch (_) {}

  const checkObjs = (stage: string, timeMs: number) => {
    let objsHas = false, objsGet = false;
    let commonObjsHas = false, commonObjsGet = false;
    if (targetObjectId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageAny = page as any;
      if (pageAny.objs) {
        objsHas = !!pageAny.objs.has(targetObjectId);
        if (objsHas && pageAny.objs.get(targetObjectId)) objsGet = true;
      }
      if (pageAny.commonObjs) {
        commonObjsHas = !!pageAny.commonObjs.has(targetObjectId);
        if (commonObjsHas && pageAny.commonObjs.get(targetObjectId)) commonObjsGet = true;
      }
    }
    renderTimeline.push({
      stage,
      timeMs,
      objsHas,
      objsGet,
      commonObjsHas,
      commonObjsGet
    });
  };

  for (const method of methods) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas context could not be created.");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    if (method.name === "display") {
      canvasLifecycle.displayBeforeW = canvas.width;
      canvasLifecycle.displayBeforeH = canvas.height;
    } else if (method.name === "display + background:white") {
      canvasLifecycle.backgroundBeforeW = canvas.width;
      canvasLifecycle.backgroundBeforeH = canvas.height;
    } else if (method.name === "print + background:white") {
      canvasLifecycle.printBeforeW = canvas.width;
      canvasLifecycle.printBeforeH = canvas.height;
    }

    if (method.background) {
      context.fillStyle = method.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderOptions: any = {
      canvasContext: context,
      viewport: viewport,
      intent: method.intent,
    };
    if (method.background) {
      renderOptions.background = method.background;
    }

    const renderTask = page.render(renderOptions);
    
    if (method.name === "display" && targetObjectId) {
      checkObjs("Render Started", performance.now());
      checkObjs("Promise Wait Start", performance.now());
    }

    await renderTask.promise;
    
    if (method.name === "display" && targetObjectId) {
      checkObjs("Promise Resolved", performance.now());
    }

    const { sampledPixelCount, nonWhitePixelCount, ratio } = calculateNonWhitePixelRatio(context, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/png");

    if (method.name === "display") {
      canvasLifecycle.displayAfterW = canvas.width;
      canvasLifecycle.displayAfterH = canvas.height;
    } else if (method.name === "display + background:white") {
      canvasLifecycle.backgroundAfterW = canvas.width;
      canvasLifecycle.backgroundAfterH = canvas.height;
    } else if (method.name === "print + background:white") {
      canvasLifecycle.printAfterW = canvas.width;
      canvasLifecycle.printAfterH = canvas.height;
    }

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
      // Memory cleanup for failed attempts
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  // Record delayed timeline
  if (targetObjectId && renderTimeline.length > 0) {
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    const t0 = performance.now();
    await wait(100);
    checkObjs("+100ms", performance.now() - t0);
    await wait(200);
    checkObjs("+300ms", performance.now() - t0);
    await wait(200);
    checkObjs("+500ms", performance.now() - t0);
    await wait(500);
    checkObjs("+1000ms", performance.now() - t0);
  }
  
  if (freshComparison && attempts.length > 0) {
    freshComparison.existingRatio = attempts[0].nonWhitePixelRatio;
  }

  let internalDebugInfo: PdfInternalDebugInfo | undefined;

  if (!successAttempt) {
    // 全ての描画方式で白紙だった場合、内部構造を調査
    internalDebugInfo = await inspectPdfInternalStructure(page, viewport);
  }

  if (internalDebugInfo) {
    internalDebugInfo.canvasLifecycle = canvasLifecycle;
    internalDebugInfo.renderTimeline = renderTimeline;
    internalDebugInfo.freshComparison = freshComparison;
    
    if (jpegDecodeErrors.length > 0) {
      internalDebugInfo.jpegDecodeErrors = jpegDecodeErrors;
    }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const info: any = {
    pageNumber: page.pageNumber,
    ocrViewport: `${viewport.width} x ${viewport.height}`,
    pdfjsVersion: "unknown", // Removed pdfjsLib usage
    workerSrc: "unknown", // Removed pdfjsLib usage
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
    
    const OPS = {
      paintImageXObject: 82,
      paintInlineImageXObject: 83,
      paintJpegXObject: 85,
      paintImageMaskXObject: 84,
      paintSolidColorImageMask: 86,
      beginGroup: 92,
      beginXObject: 95,
      paintFormXObjectBegin: 94, 
      beginAnnotation: 93, 
      beginMarkedContent: 98,
      setGState: 3,
      save: 0,
      restore: 1,
      transform: 2,
      clip: 39,
      eoClip: 40,
      rectangle: 13
    }; 
    
    const imageDetails: ImageXObjectInfo[] = [];
    const jpegDetails: JpegXObjectInfo[] = [];
    const resolutionDetails: JpegObjectResolutionInfo[] = [];
    const tSummary: TransformSummary = { total: 0, hasIssues: 0, nanCount: 0, infinityCount: 0, outsideCanvasCount: 0, negativeSizeCount: 0, extremeScaleCount: 0 };
    const cvsW = viewport.width;
    const cvsH = viewport.height;
    
    // PDF Transform stack
    const transformStack: number[][] = [];
    let currentTransform = viewport.transform ? viewport.transform.slice() : [1, 0, 0, 1, 0, 0];
    
    const clipStack: string[][] = [];
    let currentClips: string[] = [];

    function multiply(m1: number[], m2: number[]) {
      return [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
      ];
    }
    
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (OPS) {
        if (fn === OPS.save) {
          transformStack.push(currentTransform.slice());
          clipStack.push(currentClips.slice());
        }
        if (fn === OPS.restore) {
          if (transformStack.length > 0) currentTransform = transformStack.pop()!;
          if (clipStack.length > 0) currentClips = clipStack.pop()!;
        }
        if (fn === OPS.rectangle) {
          if (args && args.length >= 4) {
            currentClips.push(`rect(${args[0]},${args[1]},${args[2]},${args[3]})`);
          }
        }
        if (fn === OPS.transform) {
          tSummary.total++;
          let isNan = false, isInf = false, extreme = false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (args && args.some((a: any) => typeof a === 'number' && isNaN(a))) isNan = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (args && args.some((a: any) => typeof a === 'number' && !isFinite(a) && !isNaN(a))) isInf = true;
          
          if (args && args.length >= 6) {
            const scaleX = Math.abs(args[0]);
            const scaleY = Math.abs(args[3]);
            if ((scaleX > 10000 || scaleX < 0.0001 || scaleY > 10000 || scaleY < 0.0001) && scaleX !== 0 && scaleY !== 0) {
              extreme = true;
            }
          }

          if (isNan) tSummary.nanCount++;
          if (isInf) tSummary.infinityCount++;
          if (extreme) tSummary.extremeScaleCount++;
          if (isNan || isInf || extreme) {
            tSummary.hasIssues++;
            transformIssues += `[${i}] ${isNan?'NaN ':''}${isInf?'Inf ':''}${extreme?'Extreme ':''}`;
          }

          if (args && args.length === 6 && !isNan && !isInf) {
            currentTransform = multiply(currentTransform, args);
          }
        }
        
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
        
        if (fn === OPS.paintJpegXObject) {
           const imgName = args && args[0];
           const getOpName = (opFn: number) => {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             return Object.keys(OPS).find(key => (OPS as any)[key] === opFn) || `Op(${opFn})`;
           };
           
           const ctxBefore = [];
           const ctxAfter = [];
           for (let j = Math.max(0, i - 5); j < i; j++) {
             ctxBefore.push(`[${j}] ${getOpName(opList.fnArray[j])}`);
           }
           for (let j = i + 1; j <= Math.min(opList.fnArray.length - 1, i + 5); j++) {
             ctxAfter.push(`[${j}] ${getOpName(opList.fnArray[j])}`);
           }
           
           let exists = false;
           let constructorName = "Unknown";
           let w: string | number = "Unknown", h: string | number = "Unknown";
           let hasData = false, hasBitmap = false, hasSrc = false;
           let status = "Unknown";
           let error = "None";
           
           let objsHas = false;
           let objsGetSuccess = false;
           let commonObjsHas = false;
           let commonObjsGetSuccess = false;
           let hasImageData = false;
           let resolutionError = "None";

           try {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const pageAny = page as any;
             if (pageAny.objs) {
               objsHas = !!pageAny.objs.has(imgName);
               if (objsHas) {
                 const o = pageAny.objs.get(imgName);
                 if (o) objsGetSuccess = true;
               }
             }
             if (pageAny.commonObjs) {
               commonObjsHas = !!pageAny.commonObjs.has(imgName);
               if (commonObjsHas) {
                 const c = pageAny.commonObjs.get(imgName);
                 if (c) commonObjsGetSuccess = true;
               }
             }

             const obj = (pageAny.objs && pageAny.objs.get(imgName)) || (pageAny.commonObjs && pageAny.commonObjs.get(imgName));
             if (obj) {
               exists = true;
               constructorName = obj.constructor ? obj.constructor.name : typeof obj;
               w = obj.width ?? "Unknown";
               h = obj.height ?? "Unknown";
               hasData = !!obj.data;
               hasBitmap = !!obj.bitmap;
               hasImageData = !!obj.imageData;
               hasSrc = !!obj.src;
               status = "Object Acquired";
             } else {
               status = "Object Not Found in objs/commonObjs";
             }
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           } catch(e: any) {
             error = e.toString();
             resolutionError = e.toString();
             status = "Error during get()";
           }
           
           jpegDetails.push({
             index: i,
             argsStr: args ? JSON.stringify(args) : "[]",
             objectId: imgName || "Unknown",
             exists,
             constructorName,
             width: w,
             height: h,
             hasData,
             hasBitmap,
             hasSrc,
             status,
             error,
             contextBefore: ctxBefore,
             contextAfter: ctxAfter
           });
           
           resolutionDetails.push({
             index: i,
             objectId: imgName || "Unknown",
             objsHas,
             objsGetSuccess,
             commonObjsHas,
             commonObjsGetSuccess,
             constructorName,
             width: w,
             height: h,
             hasBitmap,
             hasData,
             hasImageData,
             hasSrc,
             error: resolutionError
           });
        }
        
        if (fn === OPS.paintImageXObject) {
           const imgName = args && args[0];
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           let w: any = "Unknown", h: any = "Unknown";
           let hasMask = false, hasSMask = false;
           try {
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const obj = page.objs?.get(imgName) || (page as any).commonObjs?.get(imgName);
             if (obj) {
               w = obj.width ?? "Unknown";
               h = obj.height ?? "Unknown";
               hasMask = !!obj.mask;
               hasSMask = !!obj.smask;
             }
           // eslint-disable-next-line @typescript-eslint/no-unused-vars
           } catch(e) {}
           
           const [a, b, c, d, e, f] = currentTransform;
           
           const pts = [
             [e, f],
             [a + e, b + f],
             [c + e, d + f],
             [a + c + e, b + d + f]
           ];
           
           const minX = Math.min(...pts.map(p => p[0]));
           const maxX = Math.max(...pts.map(p => p[0]));
           const minY = Math.min(...pts.map(p => p[1]));
           const maxY = Math.max(...pts.map(p => p[1]));
           
           const finalX = minX;
           const finalY = minY;
           const finalW = maxX - minX;
           const finalH = maxY - minY;
           
           let inside: ImageXObjectInfo['insideCanvasStatus'] = "INVALID";
           const issues = [];
           
           if (isNaN(finalX) || isNaN(finalY) || isNaN(finalW) || isNaN(finalH) ||
               !isFinite(finalX) || !isFinite(finalY) || !isFinite(finalW) || !isFinite(finalH)) {
             inside = "INVALID";
             issues.push("Invalid Coordinates");
           } else {
             if (finalW < -0.1 || finalH < -0.1) {
               issues.push("Negative Size");
               tSummary.negativeSizeCount++;
             }
             
             if (finalX >= cvsW || finalY >= cvsH || finalX + finalW <= 0 || finalY + finalH <= 0) {
               inside = "OUTSIDE";
               tSummary.outsideCanvasCount++;
             } else if (finalX >= 0 && finalY >= 0 && finalX + finalW <= cvsW && finalY + finalH <= cvsH) {
               inside = "INSIDE";
             } else {
               inside = "PARTIAL";
             }
           }
           
           imageDetails.push({
             index: i,
             imageName: imgName || "Unknown",
             width: w,
             height: h,
             hasImageMask: hasMask,
             hasSMask: hasSMask,
             prevTransform: [],
             currentTransform: currentTransform.slice(),
             clipRects: currentClips.slice(),
             finalX, finalY, finalW, finalH,
             viewportX: finalX, viewportY: finalY, viewportW: finalW, viewportH: finalH,
             insideCanvasStatus: inside,
             issues
           });
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
    
    info.imageXObjectsDetails = imageDetails;
    info.jpegXObjectsDetails = jpegDetails;
    info.jpegObjectResolutionDetails = resolutionDetails;
    info.transformSummary = tSummary;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info.dependencyCount = page.commonObjs ? Object.keys((page.commonObjs as any).objs || {}).length : 0; 

    const annots = await page.getAnnotations();
    info.annotationCount = annots.length;

    info.transformIssues = transformIssues || "None";
    info.errorsAndWarnings = "None"; 

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    info.errorsAndWarnings = err.toString();
  }

  return info as PdfInternalDebugInfo;
}
