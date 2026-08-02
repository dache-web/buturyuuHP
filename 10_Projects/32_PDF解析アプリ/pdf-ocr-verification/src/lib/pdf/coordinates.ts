import { TextItem } from "pdfjs-dist/types/src/display/api";
import { Coordinates } from "@/types/pdfAnalysis";
import { PageViewport } from "pdfjs-dist";

export function calculateCoordinates(item: TextItem, viewport: PageViewport): { original: Coordinates, normalized: Coordinates } {
  // item.transform is [scaleX, skewY, skewX, scaleY, translateX, translateY]
  const transform = item.transform;
  const originalWidth = item.width || transform[0];
  const originalHeight = item.height || transform[3]; // Fallback to scaleY if height is missing
  
  // Calculate corners in PDF coordinates
  const pdfX = transform[4];
  const pdfY = transform[5];

  // originalCoordinates: Raw PDF coordinates and sizes
  // PDF coordinate system is usually bottom-left origin
  const original: Coordinates = {
    x: pdfX,
    y: pdfY,
    width: originalWidth,
    height: originalHeight,
  };

  // Convert to viewport coordinates using a 1.0 scale viewport
  // Viewport origin is top-left
  // We need to get the bounding box in viewport coordinates
  
  // Bottom-left corner
  const [vpX1, vpY1] = viewport.convertToViewportPoint(pdfX, pdfY);
  // Top-right corner (approximate based on width and height)
  // PDF coordinates go up, so top Y is pdfY + height
  const [vpX2, vpY2] = viewport.convertToViewportPoint(pdfX + originalWidth, pdfY + originalHeight);

  // Viewport coordinates have Y going down, so vpY2 < vpY1.
  const vpX = Math.min(vpX1, vpX2);
  const vpY = Math.min(vpY1, vpY2);
  const vpWidth = Math.abs(vpX2 - vpX1);
  const vpHeight = Math.abs(vpY1 - vpY2);

  // Normalize by viewport dimensions
  const normalized: Coordinates = {
    x: vpX / viewport.width,
    y: vpY / viewport.height,
    width: vpWidth / viewport.width,
    height: vpHeight / viewport.height,
  };

  return { original, normalized };
}
