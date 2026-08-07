import React from 'react';
import type { PageAnalysis } from '@/types/pdfAnalysis';

interface OcrDebugPanelProps {
  page: PageAnalysis | undefined;
}

export function OcrDebugPanel({ page }: OcrDebugPanelProps) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const debugInfo = page?.ocrResult?.debugInfo;
  if (!debugInfo) return null;

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', border: '2px solid red', backgroundColor: '#fee' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', color: 'red' }}>[DEV ONLY] OCR Debug Info</h3>
      <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
        <tbody>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>pageNumber</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.pageNumber}</td></tr>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>viewport (W x H)</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.viewportWidth} x {debugInfo.viewportHeight}</td></tr>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>canvas (W x H)</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.canvasWidth} x {debugInfo.canvasHeight}</td></tr>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>renderScale</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.renderScale}</td></tr>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>renderIntent</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.renderIntent}</td></tr>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>nonWhitePixelRatio</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.nonWhitePixelRatio?.toFixed(6)} ({debugInfo.nonWhitePixelCount} / {debugInfo.sampledPixelCount})</td></tr>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>fallbackUsed</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.fallbackUsed ? "Yes" : "No"}</td></tr>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Tesseract words (E-1)</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.tesseractWordsCount}</td></tr>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>TextElement count (E-2)</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.textElementCount}</td></tr>
          <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Assembled Text length (F-1)</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.assembledTextLength}</td></tr>
        </tbody>
      </table>

      {debugInfo.attempts && debugInfo.attempts.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Fallback Attempts:</strong>
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '2px', textAlign: 'left' }}>Method</th>
                <th style={{ border: '1px solid #ccc', padding: '2px', textAlign: 'right' }}>PixelRatio</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {debugInfo.attempts.map((att: any, idx: number) => (
                <tr key={idx} style={{ backgroundColor: att.nonWhitePixelRatio > 0.001 ? '#dfd' : 'transparent' }}>
                  <td style={{ border: '1px solid #ccc', padding: '2px' }}>{att.methodName}</td>
                  <td style={{ border: '1px solid #ccc', padding: '2px', textAlign: 'right' }}>{att.nonWhitePixelRatio.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {debugInfo.debugDataUrl && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Canvas Preview:</strong><br />
          <img src={debugInfo.debugDataUrl} alt="OCR Canvas Preview" style={{ maxWidth: '100%', border: '1px solid #000' }} data-testid="ocr-debug-preview" />
        </div>
      )}

      {debugInfo.internalDebugInfo && (
        <div style={{ marginTop: '2rem', padding: '1rem', border: '2px solid purple', backgroundColor: '#f5f3ff' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'purple' }}>[DEV ONLY] PDF Internal Debug</h3>
          
          {debugInfo.internalDebugInfo.errorsAndWarnings !== "None" && (
            <div style={{ padding: '0.5rem', backgroundColor: '#fee2e2', color: '#991b1b', marginBottom: '1rem', borderRadius: '4px' }}>
              <strong>調査中エラー:</strong> {debugInfo.internalDebugInfo.errorsAndWarnings}
            </div>
          )}

          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Page / Viewport</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>Page {debugInfo.internalDebugInfo.pageNumber} / {debugInfo.internalDebugInfo.ocrViewport}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>PDF.js / Worker</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.pdfjsVersion} / {debugInfo.internalDebugInfo.workerSrc}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Document一致</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.isSameDocument ? 'YES' : 'NO'}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Page一致</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.isSamePage ? 'YES' : 'NO'}</td></tr>
              
              <tr><td colSpan={2} style={{ backgroundColor: '#e0e7ff', padding: '4px', fontWeight: 'bold' }}>Operator List Info</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Total Instructions</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.operatorListLength}</td></tr>
              
              <tr><td colSpan={2} style={{ backgroundColor: '#e0e7ff', padding: '4px', fontWeight: 'bold' }}>Image Ops</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>paintImageXObject</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.paintImageXObjectCount}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>paintInlineImageXObject</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.paintInlineImageXObjectCount}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>has paintJpegXObject</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.hasPaintJpegXObject ? 'YES' : 'NO'}</td></tr>
              
              <tr><td colSpan={2} style={{ backgroundColor: '#e0e7ff', padding: '4px', fontWeight: 'bold' }}>Mask & Forms</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>ImageMask Ops</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.imageMaskCount}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>SolidColorMask Ops</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.solidColorImageMaskCount}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>FormXObject / beginXObject</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.formXObjectBeginCount}</td></tr>
              
              <tr><td colSpan={2} style={{ backgroundColor: '#e0e7ff', padding: '4px', fontWeight: 'bold' }}>Others</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Annotations Count</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.annotationCount} (Ops: {debugInfo.internalDebugInfo.annotationBeginCount})</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>beginGroup Ops</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.beginGroupCount}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>beginMarkedContent Ops</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.markedContentBeginCount}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>setGState Ops</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.setGStateCount}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Dependency Count</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.dependencyCount}</td></tr>
              
              <tr><td colSpan={2} style={{ backgroundColor: '#e0e7ff', padding: '4px', fontWeight: 'bold' }}>Viewer vs OCR Comparison</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Scale</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>Viewer: {debugInfo.internalDebugInfo.viewerScale} / OCR: {debugInfo.internalDebugInfo.ocrScale}</td></tr>
              <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Rotation</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>Viewer: {debugInfo.internalDebugInfo.viewerRotation} / OCR: {debugInfo.internalDebugInfo.ocrRotation}</td></tr>
              
              {debugInfo.internalDebugInfo.transformSummary && (
                <>
                  <tr><td colSpan={2} style={{ backgroundColor: '#e0e7ff', padding: '4px', fontWeight: 'bold' }}>Transform Summary</td></tr>
                  <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Total Transforms</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.transformSummary.total}</td></tr>
                  <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Transforms w/ Issues</td><td style={{ border: '1px solid #ccc', padding: '4px', color: debugInfo.internalDebugInfo.transformSummary.hasIssues > 0 ? 'red' : 'inherit' }}>{debugInfo.internalDebugInfo.transformSummary.hasIssues}</td></tr>
                  <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>NaN Count</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.transformSummary.nanCount}</td></tr>
                  <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Infinity Count</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.transformSummary.infinityCount}</td></tr>
                  <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Outside Canvas Count</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.transformSummary.outsideCanvasCount}</td></tr>
                  <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Negative Size Count</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.transformSummary.negativeSizeCount}</td></tr>
                  <tr><td style={{ border: '1px solid #ccc', padding: '4px' }}>Extreme Scale Count</td><td style={{ border: '1px solid #ccc', padding: '4px' }}>{debugInfo.internalDebugInfo.transformSummary.extremeScaleCount}</td></tr>
                </>
              )}
            </tbody>
          </table>

          {debugInfo.internalDebugInfo.imageXObjectsDetails && debugInfo.internalDebugInfo.imageXObjectsDetails.length > 0 && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Image XObject Details</h4>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Idx</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Name</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>W x H</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Mask</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Transform [a,b,c,d,e,f]</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Final Box (X, Y, W, H)</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Inside Canvas?</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Clip Rects</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {debugInfo.internalDebugInfo.imageXObjectsDetails.map((img: any, i: number) => (
                    <tr key={i} style={{ backgroundColor: img.insideCanvasStatus === "INSIDE" ? '#ecfdf5' : img.insideCanvasStatus === "INVALID" ? '#fef2f2' : 'transparent' }}>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{img.index}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{img.imageName}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{img.width} x {img.height}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{img.hasImageMask ? 'Image' : ''}{img.hasSMask ? 'S' : ''}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px', fontSize: '0.7rem' }}>
                        [{img.currentTransform.map((v: unknown) => typeof v === 'number' ? v.toFixed(2) : v).join(', ')}]
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>
                        {img.finalX.toFixed(1)}, {img.finalY.toFixed(1)}, {img.finalW.toFixed(1)}, {img.finalH.toFixed(1)}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold', color: img.insideCanvasStatus === "OUTSIDE" ? 'red' : 'inherit' }}>
                        {img.insideCanvasStatus}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '2px', fontSize: '0.7rem' }}>
                        {img.clipRects.length > 0 ? img.clipRects.join(' | ') : 'None'}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '2px', color: 'red' }}>
                        {img.issues.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {debugInfo.internalDebugInfo.jpegXObjectsDetails && debugInfo.internalDebugInfo.jpegXObjectsDetails.length > 0 && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>JPEG XObject Summary</h4>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Idx</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Object ID</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Exists</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Constructor</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>W x H</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Data</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Bitmap</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Source</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Status</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {debugInfo.internalDebugInfo.jpegXObjectsDetails.map((jpg: any, i: number) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{jpg.index}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{jpg.objectId}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{jpg.exists ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{jpg.constructorName}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{jpg.width} x {jpg.height}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{jpg.hasData ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{jpg.hasBitmap ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{jpg.hasSrc ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{jpg.status}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px', color: 'red' }}>{jpg.error !== 'None' ? jpg.error : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h4 style={{ margin: '1rem 0 0.5rem 0' }}>JPEG Operator Context</h4>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {debugInfo.internalDebugInfo.jpegXObjectsDetails.map((jpg: any, i: number) => (
                <div key={i} style={{ marginBottom: '1rem', fontSize: '0.8rem', backgroundColor: '#fff', padding: '4px', border: '1px solid #ccc' }}>
                  <strong>[Index: {jpg.index}] {jpg.objectId}</strong><br/>
                  <em>Before:</em> {jpg.contextBefore.join(' -> ')}<br/>
                  <strong style={{ color: 'blue' }}>-&gt; paintJpegXObject {jpg.argsStr}</strong><br/>
                  <em>After:</em> {jpg.contextAfter.join(' -> ')}
                </div>
              ))}
            </div>
          )}

          {debugInfo.internalDebugInfo.jpegObjectResolutionDetails && debugInfo.internalDebugInfo.jpegObjectResolutionDetails.length > 0 && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>JPEG Object Resolution</h4>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Object ID</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>objs.has</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>objs.get</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>commonObjs.has</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>commonObjs.get</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Constructor</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Width</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Height</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Bitmap</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Data</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Image Data</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {debugInfo.internalDebugInfo.jpegObjectResolutionDetails.map((res: any, i: number) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.objectId}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.objsHas ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.objsGetSuccess ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.commonObjsHas ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.commonObjsGetSuccess ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.constructorName}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.width}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.height}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.hasBitmap ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.hasData ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{res.hasImageData ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px', color: 'red' }}>{res.error !== 'None' ? res.error : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {debugInfo.internalDebugInfo.renderTimeline && debugInfo.internalDebugInfo.renderTimeline.length > 0 && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Render Timeline</h4>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Stage</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Time (ms)</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>objs.has</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>objs.get</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>commonObjs.has</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>commonObjs.get</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {debugInfo.internalDebugInfo.renderTimeline.map((tl: any, i: number) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>{tl.stage}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{tl.timeMs.toFixed(1)}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{tl.objsHas ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{tl.objsGet ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{tl.commonObjsHas ? 'YES' : 'NO'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>{tl.commonObjsGet ? 'YES' : 'NO'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {debugInfo.internalDebugInfo.freshComparison && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Fresh Document Comparison</h4>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Metric</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Existing (w/ Display)</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Fresh (w/ Display)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>Canvas WxH</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.existingCanvasW} x {debugInfo.internalDebugInfo.freshComparison.existingCanvasH}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.freshCanvasW} x {debugInfo.internalDebugInfo.freshComparison.freshCanvasH}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>nonWhitePixelRatio</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.existingRatio.toFixed(6)}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.freshRatio.toFixed(6)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>Operator Instructions</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.existingOpCount}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.freshOpCount}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>paintJpegXObject Count</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.existingPaintJpegCount}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.freshPaintJpegCount}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>objs.has before</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>-</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.freshObjsHasBefore ? 'YES' : 'NO'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>objs.has after</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>-</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.freshObjsHasAfter ? 'YES' : 'NO'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>objs.get before</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>-</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.freshObjsGetBefore ? 'YES' : 'NO'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>objs.get after</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>-</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.freshObjsGetAfter ? 'YES' : 'NO'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px', fontWeight: 'bold' }}>Render Error</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>-</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.freshComparison.freshRenderError}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {debugInfo.internalDebugInfo.canvasLifecycle && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Canvas Lifecycle</h4>
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Stage</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>Before Render (W x H)</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px' }}>After Render (W x H)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>display</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.canvasLifecycle.displayBeforeW} x {debugInfo.internalDebugInfo.canvasLifecycle.displayBeforeH}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.canvasLifecycle.displayAfterW} x {debugInfo.internalDebugInfo.canvasLifecycle.displayAfterH}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>background:white</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.canvasLifecycle.backgroundBeforeW} x {debugInfo.internalDebugInfo.canvasLifecycle.backgroundBeforeH}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.canvasLifecycle.backgroundAfterW} x {debugInfo.internalDebugInfo.canvasLifecycle.backgroundAfterH}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>print</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.canvasLifecycle.printBeforeW} x {debugInfo.internalDebugInfo.canvasLifecycle.printBeforeH}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px' }}>{debugInfo.internalDebugInfo.canvasLifecycle.printAfterW} x {debugInfo.internalDebugInfo.canvasLifecycle.printAfterH}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
