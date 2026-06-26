/**
 * NativeMlKitOcrProvider tests.
 *
 * The native Android OCR path (Capacitor + ML Kit via @jcesarmobile/capacitor-ocr).
 * @capacitor/core and the lazily-imported plugin are mocked — these cover the
 * provider seam contract: Android-only availability, base64 hand-off, block-text
 * joining, confidence aggregation (already 0–1 from ML Kit/Vision), and blob
 * zeroization. The plugin is dynamic-imported inside recognize() so it never
 * loads on the web build; vi.mock intercepts that dynamic import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { isNativeAndroidAppMock, processMock, clearImageDataMock } = vi.hoisted(
  () => ({
    isNativeAndroidAppMock: vi.fn(() => true),
    processMock: vi.fn(() =>
      Promise.resolve({
        results: [
          { text: 'user@example.com', confidence: 0.9 },
          { text: 'Tr0ub4dor&3', confidence: 0.8 },
        ],
      })
    ),
    clearImageDataMock: vi.fn(() => Promise.resolve()),
  })
);

vi.mock('@/core/platform/runtime', () => ({
  isNativeAndroidApp: isNativeAndroidAppMock,
  isNativeApp: vi.fn(() => true),
}));
vi.mock('@jcesarmobile/capacitor-ocr', () => ({ Ocr: { process: processMock } }));
vi.mock('@/core/ocr/cameraCapture', () => ({
  clearImageData: clearImageDataMock,
  blobToDataUrl: vi.fn(() => Promise.resolve('data:image/png;base64,AAAA')),
}));

import { NativeMlKitOcrProvider } from '@/core/ocr/nativeMlKitOcrProvider';

describe('NativeMlKitOcrProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativeAndroidAppMock.mockReturnValue(true);
  });

  describe('isAvailable()', () => {
    it('is available on native Android', () => {
      expect(new NativeMlKitOcrProvider().isAvailable()).toBe(true);
    });

    it('is NOT available off native Android (web / iOS — seam returns false)', () => {
      isNativeAndroidAppMock.mockReturnValue(false);
      expect(new NativeMlKitOcrProvider().isAvailable()).toBe(false);
    });

    it('does not stream progress (ML Kit returns synchronously-fast)', () => {
      expect(new NativeMlKitOcrProvider().streamsProgress).toBe(false);
    });
  });

  describe('recognize()', () => {
    it('hands the captured frame to the plugin as a base64 data URL', async () => {
      const provider = new NativeMlKitOcrProvider();

      await provider.recognize(() => Promise.resolve(new Blob(['frame'])));

      expect(processMock).toHaveBeenCalledWith({ image: 'data:image/png;base64,AAAA' });
    });

    it('joins block texts with newlines and averages confidence (0–1)', async () => {
      const provider = new NativeMlKitOcrProvider();

      const result = await provider.recognize(() => Promise.resolve(new Blob(['frame'])));

      expect(result.text).toBe('user@example.com\nTr0ub4dor&3');
      expect(result.engineConfidence).toBeCloseTo(0.85);
    });

    it('returns undefined confidence when no text blocks are found', async () => {
      processMock.mockResolvedValueOnce({ results: [] });
      const provider = new NativeMlKitOcrProvider();

      const result = await provider.recognize(() => Promise.resolve(new Blob(['frame'])));

      expect(result.text).toBe('');
      expect(result.engineConfidence).toBeUndefined();
    });

    it('clamps an out-of-range engine confidence into [0, 1]', async () => {
      processMock.mockResolvedValueOnce({ results: [{ text: 'x', confidence: 5 }] });
      const provider = new NativeMlKitOcrProvider();

      const result = await provider.recognize(() => Promise.resolve(new Blob(['frame'])));

      expect(result.engineConfidence).toBe(1);
    });

    it('zeroizes the captured blob after recognition', async () => {
      const provider = new NativeMlKitOcrProvider();
      const blob = new Blob(['secret frame']);

      await provider.recognize(() => Promise.resolve(blob));

      expect(clearImageDataMock).toHaveBeenCalledWith(blob);
    });

    it('still zeroizes the blob when the plugin throws', async () => {
      processMock.mockRejectedValueOnce(new Error('ml kit failed'));
      const provider = new NativeMlKitOcrProvider();
      const blob = new Blob(['secret frame']);

      await expect(
        provider.recognize(() => Promise.resolve(blob))
      ).rejects.toThrow('ml kit failed');
      expect(clearImageDataMock).toHaveBeenCalledWith(blob);
    });
  });
});
