/**
 * Native Android bounding-box OCR provider (Phase 4 — optional overlay).
 *
 * Routes through @capacitor-community/image-to-text (Android: Firebase ML
 * Vision) instead of @jcesarmobile/capacitor-ocr to get corner-point geometry
 * for a live overlay. Only selected when the user opts into the experimental
 * Settings toggle (see ocrSettings.ts) — getOcrProviders() picks this over
 * NativeMlKitOcrProvider in that case. Trade-offs (see
 * docs/OCR_NATIVE_ANDROID_PLAN.md §Phase 4 and SECURITY.md):
 *   - No confidence score — engineConfidence is always undefined here, so the
 *     parser falls back to its own field-level heuristics.
 *   - Pulls in Firebase ML Vision (requires google-services.json on Android).
 *
 * Lazy dynamic-imported inside recognize() — mirrors NativeMlKitOcrProvider —
 * so the plugin never enters the web bundle and stays out of the binary
 * unless this code path actually runs (off by default).
 */

import { isNativeAndroidApp } from '@/core/platform/runtime';
import { blobToDataUrl, clearImageData } from './cameraCapture';
import type { OcrBoundingBox, OcrProvider, OcrRecognition } from './ocrProvider';
import type { OcrMode, OCRProgress } from './tesseractService';

export class NativeBoundingBoxOcrProvider implements OcrProvider {
  readonly name = 'image-to-text-native';
  readonly streamsProgress = false;

  isAvailable(): boolean {
    return isNativeAndroidApp();
  }

  async recognize(
    getBlob: () => Promise<Blob>,
    _onProgress?: (progress: OCRProgress) => void,
    _mode: OcrMode = 'form'
  ): Promise<OcrRecognition> {
    const blob = await getBlob();
    try {
      const { Ocr } = await import('@capacitor-community/image-to-text');
      const dataUrl = await blobToDataUrl(blob);
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const { textDetections } = await Ocr.detectText({ base64 });

      const text = textDetections.map((d) => d.text).join('\n');
      const boundingBoxes: OcrBoundingBox[] = textDetections.map((d) => ({
        text: d.text,
        corners: [d.topLeft, d.topRight, d.bottomRight, d.bottomLeft],
      }));

      return { text, boundingBoxes };
    } finally {
      // Always zeroize the in-memory frame, even on recognition failure.
      await clearImageData(blob);
    }
  }
}
