export function getPdfjsOptions(pdfjsVersion: string) {
  const cdnBase = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/`;
  
  return {
    cMapUrl: `${cdnBase}cmaps/`,
    cMapPacked: true,
    wasmUrl: `${cdnBase}wasm/`,
  };
}

export function getWorkerSrc(pdfjsVersion: string, useDebug: boolean = false) {
  if (useDebug) {
    return '/pdf.worker.debug.mjs';
  }
  return `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
}


