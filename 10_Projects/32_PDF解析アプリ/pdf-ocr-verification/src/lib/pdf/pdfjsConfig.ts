export function getPdfjsOptions(pdfjsVersion: string) {
  const cdnBase = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/`;
  
  return {
    wasmUrl: `${cdnBase}wasm/`,
  };
}

export function getWorkerSrc(pdfjsVersion: string, useDebug: boolean = false) {
  if (useDebug) {
    return '/pdf.worker.debug.mjs';
  }
  return `//unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
}
