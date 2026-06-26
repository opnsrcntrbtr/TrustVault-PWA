/**
 * TrustVault OCR Provider seam.
 *
 * A single abstraction over OCR engines so a native, higher-precision path
 * (Android ML Kit via Capacitor — see docs/OCR_NATIVE_ANDROID_PLAN.md) can slot
 * in alongside the browser Tesseract.js path without touching downstream parsing
 * or the camera UI. Selection is availability-based: the first provider that can
 * run on the current surface wins, with Tesseract as the universal fallback.
 */

import {
  recognizeText,
  isOCRSupported,
  type OCRProgress,
  type OcrMode,
} from './tesseractService';
import { clearImageData } from './cameraCapture';

export interface OcrRecognition {
  text: string;
  /** Engine self-confidence, normalized 0–1 (undefined if the engine has none). */
  engineConfidence?: number;
}

export interface OcrProvider {
  /** Stable identifier for diagnostics / UI. */
  readonly name: string;
  /** Whether this provider emits incremental progress (drives the progress bar). */
  readonly streamsProgress: boolean;
  /** Can this provider run on the current surface? */
  isAvailable(): boolean;
  /**
   * Recognize text from a lazily-captured frame.
   * The provider owns the blob lifecycle: it pulls the frame via `getBlob`,
   * recognizes it, and zeroizes it before resolving.
   */
  recognize(
    getBlob: () => Promise<Blob>,
    onProgress?: (progress: OCRProgress) => void,
    mode?: OcrMode
  ): Promise<OcrRecognition>;
}

/**
 * Browser OCR via Tesseract.js (WASM). Universal fallback — available wherever
 * the camera/getUserMedia stack is.
 */
export class TesseractOcrProvider implements OcrProvider {
  readonly name = 'tesseract';
  readonly streamsProgress = true;

  isAvailable(): boolean {
    return isOCRSupported();
  }

  async recognize(
    getBlob: () => Promise<Blob>,
    onProgress?: (progress: OCRProgress) => void,
    mode: OcrMode = 'form'
  ): Promise<OcrRecognition> {
    const blob = await getBlob();
    try {
      const { text, confidence } = await recognizeText(blob, onProgress, mode);
      return { text, engineConfidence: confidence / 100 };
    } finally {
      // Always zeroize the in-memory frame, even on recognition failure.
      await clearImageData(blob);
    }
  }
}

/**
 * Ordered provider registry. Native providers (Phase 3) prepend ahead of
 * Tesseract so they're preferred when available.
 */
export function getOcrProviders(): OcrProvider[] {
  return [new TesseractOcrProvider()];
}

/**
 * Select the first available provider, falling back to Tesseract.
 * `providers` is injectable for testing.
 */
export function getActiveOcrProvider(
  providers: OcrProvider[] = getOcrProviders()
): OcrProvider {
  return providers.find((p) => p.isAvailable()) ?? new TesseractOcrProvider();
}
