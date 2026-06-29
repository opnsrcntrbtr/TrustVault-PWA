/**
 * OCR settings (Phase 4 — bounding-box overlay, experimental, off by default).
 * localStorage module — mirrors aiSettings.ts. No Zustand.
 */

export interface OcrSettings {
  /** Show a live bounding-box overlay after capture using the native ML Vision
   *  text-detection plugin instead of the confidence-scoring ML Kit provider.
   *  Off by default: pulls in Firebase ML Vision (see SECURITY.md). */
  ocrShowBoundingBoxOverlay: boolean;
}

const STORAGE_KEY = 'trustvault_ocr_settings';

export const DEFAULT_OCR_SETTINGS: OcrSettings = {
  ocrShowBoundingBoxOverlay: false,
};

export function loadOcrSettings(): OcrSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<OcrSettings>;
      return { ...DEFAULT_OCR_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load OCR settings:', error);
  }
  return DEFAULT_OCR_SETTINGS;
}

export function saveOcrSettings(settings: OcrSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save OCR settings:', error);
  }
}
