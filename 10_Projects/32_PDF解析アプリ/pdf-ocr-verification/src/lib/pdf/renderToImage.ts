import * as pdfjsLib from "pdfjs-dist";

/**
 * Renders a specified page of a PDF document to a Base64-encoded PNG image.
 * The resolution is adjusted to be suitable for OCR (long edge around 2500px).
 * 
 * @param pdfDocument The loaded PDF document proxy
 * @param pageNumber The page number to render (1-indexed)
 * @returns A promise that resolves to a Base64 string ("data:image/png;base64,...")
 */
export async function renderPageToImageBase64(
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const page = await pdfDocument.getPage(pageNumber);

  // Get default viewport at scale 1.0 to determine base dimensions
  const baseViewport = page.getViewport({ scale: 1.0 });

  // Target max dimension for OCR (e.g., 2500px for good DPI)
  const targetMaxDimension = 2500;
  const maxDim = Math.max(baseViewport.width, baseViewport.height);
  
  // Calculate scale to hit the target dimension, but cap it so we don't scale up too tiny things excessively
  // Typical PDF scale 1.0 is 72 DPI. 3.0 scale is ~216 DPI which is good for OCR.
  let scale = targetMaxDimension / maxDim;
  if (scale < 1.5) scale = 1.5;
  if (scale > 4.0) scale = 4.0;

  const viewport = page.getViewport({ scale });

  // Create a hidden canvas
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to get 2D context for canvas.");
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  // Ensure background is white (PDFs might be transparent)
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderContext: any = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  // Convert to Base64 PNG
  const base64Image = canvas.toDataURL("image/png");

  // Clean up
  canvas.width = 0;
  canvas.height = 0;

  return base64Image;
}
