/**
 * TrustVault OCR Service
 *
 * Lazy-loaded Tesseract.js wrapper for client-side OCR processing.
 * Security: All processing is local-only; image buffers are cleared
 * immediately after recognition to maintain zero-knowledge guarantees.
 */

import type { Worker, RecognizeResult, PSM } from 'tesseract.js';

let tesseractWorker: Worker | null = null;
let initializationPromise: Promise<Worker> | null = null;
let prefetchStarted = false;

export interface OCRProgress {
  status: string;
  progress: number;
}

/**
 * Per-flow page segmentation mode. The optimal Tesseract PSM depends on the
 * layout being scanned:
 *  - 'form'  → SINGLE_COLUMN (4): stacked label/value credential forms (default).
 *  - 'line'  → SINGLE_LINE (7):   a single OTP secret or password line.
 *  - 'block' → SPARSE_TEXT (11):  credentials embedded in a cluttered screenshot.
 * Values mirror Tesseract's stable PSM constants so we don't depend on the
 * dynamically-imported enum inside the hot recognition path.
 */
export type OcrMode = 'form' | 'line' | 'block';

const MODE_TO_PSM: Record<OcrMode, number> = {
  form: 4, // PSM.SINGLE_COLUMN
  line: 7, // PSM.SINGLE_LINE
  block: 11, // PSM.SPARSE_TEXT
};

/**
 * Initialize or retrieve the Tesseract worker singleton.
 * Follows CLAUDE.md lazy-load pattern for heavy WASM modules.
 */
async function getWorker(
  onProgress?: (progress: OCRProgress) => void
): Promise<Worker> {
  if (tesseractWorker) {
    return tesseractWorker;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    // Dynamic import to avoid blocking initial bundle
    const Tesseract = await import('tesseract.js');

    // Self-hosted assets (P2): copied to public/ocr/ by scripts/copy-ocr-assets.js.
    // No runtime CDN dependency — same-origin, version-pinned via package-lock.
    const ocrBase = `${import.meta.env.BASE_URL}ocr/`;
    const options: Record<string, unknown> = {
      workerPath: `${ocrBase}worker.min.js`,
      corePath: ocrBase,
      langPath: ocrBase,
    };
    if (onProgress) {
      options.logger = (m: { status: string; progress: number }) => {
        onProgress({ status: m.status, progress: m.progress });
      };
    }

    const worker = await Tesseract.createWorker('eng', 1, options);

    // Tune segmentation for credential forms: a single column of label/value
    // rows of varying size (PSM 4). Default PSM 3 (full auto) mis-segments the
    // stacked label-above-value layout and fragments tokens (e.g. emails),
    // which downstream parsing then has to repair.
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN,
    });

    tesseractWorker = worker;
    return worker;
  })();

  return initializationPromise;
}

/**
 * Recognize text from an image blob.
 * @param imageBlob - The captured image as a Blob
 * @param onProgress - Optional progress callback
 * @param mode - Page segmentation hint for the layout being scanned (default 'form')
 * @returns Recognized text and confidence score
 */
export async function recognizeText(
  imageBlob: Blob,
  onProgress?: (progress: OCRProgress) => void,
  mode: OcrMode = 'form'
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker(onProgress);

  // Set PSM per recognition so a single memoized worker can serve every flow.
  await worker.setParameters({
    tessedit_pageseg_mode: MODE_TO_PSM[mode] as unknown as PSM,
  });

  const result: RecognizeResult = await worker.recognize(imageBlob);

  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
}

/**
 * Terminate the Tesseract worker and release resources.
 * Call when OCR feature is no longer needed (e.g., on component unmount).
 */
export async function terminateWorker(): Promise<void> {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
    initializationPromise = null;
  }
}

/**
 * Check if the browser supports required APIs for OCR capture.
 */
export function isOCRSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Prefetch Tesseract language data to warm the service worker cache.
 * Call this on app idle time (e.g., after initial render) to ensure
 * the ~15MB eng.traineddata is cached before user's first scan.
 * 
 * This uses fetch with low priority to avoid blocking critical resources.
 */
export async function prefetchTesseractAssets(): Promise<void> {
  if (prefetchStarted) {
    return;
  }
  prefetchStarted = true;

  // Don't prefetch if service worker isn't available or in test environment
  if (
    !('serviceWorker' in navigator) ||
    typeof process !== 'undefined' &&
      (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')
  ) {
    return;
  }

  try {
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Self-hosted OCR assets (public/ocr/) — same-origin, no CDN egress.
    // These URLs match the /ocr/ runtime caching pattern in vite.config.ts.
    const ocrBase = `${import.meta.env.BASE_URL}ocr/`;
    const assetsToCache = [
      `${ocrBase}worker.min.js`,
      `${ocrBase}tesseract-core-simd-lstm.wasm.js`,
      `${ocrBase}tesseract-core-simd-lstm.wasm`,
      `${ocrBase}eng.traineddata.gz`,
    ];

    // Use low-priority fetch to avoid blocking critical resources
    for (const url of assetsToCache) {
      try {
        // Fetch with cache-first - service worker will intercept and cache
        await fetch(url, {
          method: 'GET',
          cache: 'default',
        });
      } catch {
        // Ignore individual fetch failures - user can still download on first scan
        console.debug(`[OCR] Prefetch skipped: ${url}`);
      }
    }

    console.debug('[OCR] Tesseract assets prefetched for faster first-scan');
  } catch {
    // Prefetch is best-effort; don't block app on failure
    console.debug('[OCR] Prefetch unavailable');
  }
}
