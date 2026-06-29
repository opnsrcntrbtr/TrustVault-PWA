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
import { NativeMlKitOcrProvider } from './nativeMlKitOcrProvider';
import { NativeBoundingBoxOcrProvider } from './nativeBoundingBoxOcrProvider';
import { loadOcrSettings } from './ocrSettings';

/** A single detected text block's corner geometry (Phase 4 — overlay only). */
export interface OcrBoundingBox {
  text: string;
  /** [topLeft, topRight, bottomRight, bottomLeft], in captured-frame pixel space. */
  corners: [number, number][];
}

export interface OcrRecognition {
  text: string;
  /** Engine self-confidence, normalized 0–1 (undefined if the engine has none). */
  engineConfidence?: number;
  /** Per-block geometry for the optional bounding-box overlay (native only). */
  boundingBoxes?: OcrBoundingBox[];
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
 * Ordered provider registry. The native Android ML Kit provider is preferred
 * when available (native Android); Tesseract is the universal fallback for
 * every other surface (web, iOS Safari, un-wrapped Android).
 *
 * When the experimental bounding-box overlay setting is on (Phase 4, off by
 * default), the bounding-box variant takes the native slot instead — it
 * trades the confidence score for corner geometry the camera dialog can draw.
 */
export function getOcrProviders(
  preferOverlay: boolean = loadOcrSettings().ocrShowBoundingBoxOverlay
): OcrProvider[] {
  const nativeProvider = preferOverlay
    ? new NativeBoundingBoxOcrProvider()
    : new NativeMlKitOcrProvider();
  return [nativeProvider, new TesseractOcrProvider()];
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
