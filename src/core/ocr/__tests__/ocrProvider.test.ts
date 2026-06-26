/**
 * OcrProvider seam tests.
 *
 * The provider abstraction lets a native (Android ML Kit) OCR path slot in
 * alongside the browser Tesseract path behind one interface. These tests cover
 * the seam itself — recognition delegation, blob zeroization, engine-confidence
 * normalization (0–100 → 0–1), and availability-based selection — with the
 * underlying tesseract/camera modules mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { recognizeTextMock, clearImageDataMock, isOCRSupportedMock } = vi.hoisted(
  () => ({
    recognizeTextMock: vi.fn(() =>
      Promise.resolve({ text: 'user: a@b.com', confidence: 80 })
    ),
    clearImageDataMock: vi.fn(() => Promise.resolve()),
    isOCRSupportedMock: vi.fn(() => true),
  })
);

vi.mock('@/core/ocr/tesseractService', () => ({
  recognizeText: recognizeTextMock,
  isOCRSupported: isOCRSupportedMock,
}));
vi.mock('@/core/ocr/cameraCapture', () => ({
  clearImageData: clearImageDataMock,
}));

import {
  TesseractOcrProvider,
  getActiveOcrProvider,
  type OcrProvider,
} from '@/core/ocr/ocrProvider';

describe('TesseractOcrProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOCRSupportedMock.mockReturnValue(true);
  });

  it('streams progress and reports availability from isOCRSupported()', () => {
    const provider = new TesseractOcrProvider();

    expect(provider.streamsProgress).toBe(true);
    expect(provider.isAvailable()).toBe(true);

    isOCRSupportedMock.mockReturnValue(false);
    expect(provider.isAvailable()).toBe(false);
  });

  it('recognizes the pulled blob and normalizes engine confidence to 0–1', async () => {
    const provider = new TesseractOcrProvider();
    const blob = new Blob(['img']);

    const result = await provider.recognize(() => Promise.resolve(blob));

    expect(recognizeTextMock).toHaveBeenCalledWith(blob, undefined, 'form');
    expect(result.text).toBe('user: a@b.com');
    expect(result.engineConfidence).toBeCloseTo(0.8);
  });

  it('forwards the progress callback and segmentation mode', async () => {
    const provider = new TesseractOcrProvider();
    const onProgress = vi.fn();

    await provider.recognize(() => Promise.resolve(new Blob(['x'])), onProgress, 'line');

    expect(recognizeTextMock).toHaveBeenCalledWith(expect.any(Blob), onProgress, 'line');
  });

  it('zeroizes the captured blob after recognition (security guarantee)', async () => {
    const provider = new TesseractOcrProvider();
    const blob = new Blob(['secret frame']);

    await provider.recognize(() => Promise.resolve(blob));

    expect(clearImageDataMock).toHaveBeenCalledWith(blob);
  });

  it('still zeroizes the blob when recognition throws', async () => {
    recognizeTextMock.mockRejectedValueOnce(new Error('ocr failed'));
    const provider = new TesseractOcrProvider();
    const blob = new Blob(['secret frame']);

    await expect(provider.recognize(() => Promise.resolve(blob))).rejects.toThrow('ocr failed');
    expect(clearImageDataMock).toHaveBeenCalledWith(blob);
  });
});

describe('getActiveOcrProvider()', () => {
  it('returns the first available provider', () => {
    const unavailable: OcrProvider = {
      name: 'native',
      streamsProgress: false,
      isAvailable: () => false,
      recognize: vi.fn(),
    };
    const available: OcrProvider = {
      name: 'fallback',
      streamsProgress: true,
      isAvailable: () => true,
      recognize: vi.fn(),
    };

    expect(getActiveOcrProvider([unavailable, available])).toBe(available);
  });

  it('falls back to Tesseract when none report available', () => {
    const none: OcrProvider = {
      name: 'native',
      streamsProgress: false,
      isAvailable: () => false,
      recognize: vi.fn(),
    };

    const active = getActiveOcrProvider([none]);

    expect(active).toBeInstanceOf(TesseractOcrProvider);
  });
});
