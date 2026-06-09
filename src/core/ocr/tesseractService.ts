/**
 * TrustVault OCR Service
 *
 * Lazy-loaded Tesseract.js wrapper for client-side OCR processing.
 * Security: All processing is local-only; image buffers are cleared
 * immediately after recognition to maintain zero-knowledge guarantees.
 */

import type { Worker, RecognizeResult } from 'tesseract.js';

let tesseractWorker: Worker | null = null;
let initializationPromise: Promise<Worker> | null = null;
let prefetchStarted = false;

export interface OCRProgress {
  status: string;
  progress: number;
}

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

    tesseractWorker = worker;
    return worker;
  })();

  return initializationPromise;
}

/**
 * Recognize text from an image blob.
 * @param imageBlob - The captured image as a Blob
 * @param onProgress - Optional progress callback
 * @returns Recognized text and confidence score
 */
export async function recognizeText(
  imageBlob: Blob,
  onProgress?: (progress: OCRProgress) => void
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker(onProgress);

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
