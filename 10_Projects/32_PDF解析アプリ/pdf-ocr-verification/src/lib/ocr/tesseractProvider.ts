/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { OcrResult, TextElement } from "@/types/pdfAnalysis";
import type { OcrOptions } from "./ocrProvider";

export async function runTesseractOcr({ imageUrl, imageWidth, imageHeight, pageNumber }: OcrOptions): Promise<OcrResult> {
  if (typeof window === "undefined") {
    throw new Error("OCRはブラウザ上でのみ実行できます。");
  }

  const startTime = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worker: any = null;

  try {
    const { createWorker } = await import("tesseract.js");

    worker = await createWorker("jpn", 1, {
      workerPath: "https://unpkg.com/tesseract.js@v5.1.0/dist/worker.min.js",
      corePath: "https://unpkg.com/tesseract.js-core@v5.1.0",
      // langPath relies on default CDN (https://tessdata.projectnaptha.com/4.0.0)
    });

    const result = await worker.recognize(
      imageUrl,
      {},
      { blocks: true }
    );

    const { data: { text, confidence, blocks } } = result;
    const elements: TextElement[] = [];
    let tesseractWordsCount = 0;

    // 第2工程: OCR座標からTextElementへの変換
    if (blocks && Array.isArray(blocks)) {
      let wordIndex = 0;
      blocks.forEach((block: any) => {
        if (block.paragraphs) {
          block.paragraphs.forEach((paragraph: any) => {
            if (paragraph.lines) {
              paragraph.lines.forEach((line: any, lineIdx: number, lineArr: any[]) => {
                if (line.words) {
                  line.words.forEach((word: any, wordIdx: number, wordArr: any[]) => {
                    if (word.text && word.text.trim().length > 0) {
                      tesseractWordsCount++;
                    }
                    if (word.text && word.bbox) {
                      const { x0, y0, x1, y1 } = word.bbox;
                      const width = x1 - x0;
                      const height = y1 - y0;

                      // Normalize coordinates (0.0 to 1.0)
                      const normX = x0 / imageWidth;
                      const normY = y0 / imageHeight;
                      const normW = width / imageWidth;
                      const normH = height / imageHeight;

                      const isLastWordInLine = wordIdx === wordArr.length - 1;

                      elements.push({
                        id: `ocr_p${pageNumber}_w${wordIndex++}`,
                        pageNumber,
                        elementType: "ocr_text",
                        text: word.text,
                        readingOrder: wordIndex,
                        source: "tesseract",
                        confidence: word.confidence || 0,
                        fontName: "OCR",
                        hasEOL: isLastWordInLine,
                        originalCoordinates: {
                          x: x0,
                          y: y0,
                          width,
                          height
                        },
                        normalizedCoordinates: {
                          x: normX,
                          y: normY,
                          width: normW,
                          height: normH
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    }

    const assembledText = text ? text.trim() : "";
    const textElementCount = elements.length;
    const assembledTextLength = assembledText.length;

    const tesseractDebugInfo = {
      tesseractWordsCount,
      textElementCount,
      assembledTextLength
    };

    if (assembledTextLength === 0 || textElementCount === 0) {
      return {
        status: "failed",
        pageNumber,
        text: "",
        elements: [],
        confidence: confidence || 0,
        processingTime: Date.now() - startTime,
        provider: "tesseract.js v5.1.0",
        errorMessage: "OCR処理は完了しましたが、取得文字数が0件でした。",
        debugInfo: tesseractDebugInfo
      };
    }

    return {
      status: "success",
      pageNumber,
      text: assembledText,
      elements,
      confidence,
      processingTime: Date.now() - startTime,
      provider: "tesseract.js v5.1.0",
      debugInfo: tesseractDebugInfo
    };
  } catch (error: any) {
    console.error("Tesseract OCR Error:", error);
    return {
      status: "failed",
      pageNumber,
      errorMessage: error.message || "OCR処理中にエラーが発生しました",
      processingTime: Date.now() - startTime,
      provider: "tesseract.js v5.1.0"
    };
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}
