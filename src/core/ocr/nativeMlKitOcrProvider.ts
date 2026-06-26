/**
 * Native Android OCR provider — Google ML Kit Text Recognition v2 via Capacitor
 * (@jcesarmobile/capacitor-ocr). On-device, offline, zero-egress.
 *
 * Selected ahead of Tesseract only when running natively on Android (see
 * docs/OCR_NATIVE_ANDROID_PLAN.md). On the web build `isAvailable()` is false,
 * so this is inert and the plugin is never imported. The plugin is lazy
 * dynamic-imported inside recognize() — mirroring the project's WebLLM/LiteRT
 * convention — so it never enters the web bundle's eager graph.
 *
 * Scope: Android only (iOS Apple Vision path deferred — plan decision #1).
 */

import { Capacitor } from '@capacitor/core';
import { blobToDataUrl, clearImageData } from './cameraCapture';
import type { OcrProvider, OcrRecognition } from './ocrProvider';
import type { OcrMode, OCRProgress } from './tesseractService';

export class NativeMlKitOcrProvider implements OcrProvider {
  readonly name = 'mlkit-native';
  // ML Kit returns in tens of milliseconds — no incremental progress to stream.
  readonly streamsProgress = false;

  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  async recognize(
    getBlob: () => Promise<Blob>,
    // ML Kit auto-segments; the per-flow PSM hint and progress callback are
    // accepted for interface parity but unused on the native path.
    _onProgress?: (progress: OCRProgress) => void,
    _mode: OcrMode = 'form'
  ): Promise<OcrRecognition> {
    const blob = await getBlob();
    try {
      // Lazy-load so the plugin never enters the web bundle.
      const { Ocr } = await import('@jcesarmobile/capacitor-ocr');
      const image = await blobToDataUrl(blob);
      const { results } = await Ocr.process({ image });

      const text = results.map((r) => r.text).join('\n');
      const recognition: OcrRecognition = { text };
      if (results.length) {
        // ML Kit / Apple Vision confidence is already 0–1; clamp defensively.
        recognition.engineConfidence = clamp01(
          results.reduce((sum, r) => sum + r.confidence, 0) / results.length
        );
      }

      return recognition;
    } finally {
      // Always zeroize the in-memory frame, even on recognition failure.
      await clearImageData(blob);
    }
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
