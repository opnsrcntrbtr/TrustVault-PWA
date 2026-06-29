/**
 * ocrSettings tests — Phase 4 bounding-box overlay toggle.
 * Mirrors aiSettings.ts: localStorage module, no Zustand, merge-over-defaults.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_OCR_SETTINGS,
  loadOcrSettings,
  saveOcrSettings,
  type OcrSettings,
} from '@/core/ocr/ocrSettings';

const STORAGE_KEY = 'trustvault_ocr_settings';

describe('ocrSettings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('defaults the bounding-box overlay toggle to off', () => {
    expect(DEFAULT_OCR_SETTINGS).toEqual({ ocrShowBoundingBoxOverlay: false });
  });

  it('returns defaults when storage is empty', () => {
    expect(loadOcrSettings()).toEqual(DEFAULT_OCR_SETTINGS);
  });

  it('merges stored partial settings over defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ocrShowBoundingBoxOverlay: true }));
    expect(loadOcrSettings()).toEqual({ ocrShowBoundingBoxOverlay: true });
  });

  it('returns defaults when stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadOcrSettings()).toEqual(DEFAULT_OCR_SETTINGS);
  });

  it('persists settings via saveOcrSettings', () => {
    const next: OcrSettings = { ocrShowBoundingBoxOverlay: true };
    saveOcrSettings(next);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual(next);
    expect(loadOcrSettings()).toEqual(next);
  });
});
