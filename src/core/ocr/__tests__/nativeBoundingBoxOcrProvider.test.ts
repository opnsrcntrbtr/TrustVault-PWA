/**
 * NativeBoundingBoxOcrProvider tests (Phase 4 — optional overlay).
 *
 * Routes through @capacitor-community/image-to-text instead of
 * @jcesarmobile/capacitor-ocr to get corner-point geometry for a live
 * bounding-box overlay. Trade-off (documented in the OCR plan/SECURITY.md):
 * no confidence score, and the Android side requires Firebase ML Vision
 * (google-services.json). Only loaded when the user opts into the
 * experimental Settings toggle — these tests mock the lazy-imported plugin.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { isNativeAndroidAppMock, detectTextMock, clearImageDataMock } = vi.hoisted(
  () => ({
    isNativeAndroidAppMock: vi.fn(() => true),
    detectTextMock: vi.fn(() =>
      Promise.resolve({
        textDetections: [
          {
            text: 'user@example.com',
            topLeft: [10, 10],
            topRight: [100, 10],
            bottomRight: [100, 30],
            bottomLeft: [10, 30],
          },
          {
            text: 'Tr0ub4dor&3',
            topLeft: [10, 40],
            topRight: [100, 40],
            bottomRight: [100, 60],
            bottomLeft: [10, 60],
          },
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
vi.mock('@capacitor-community/image-to-text', () => ({
  Ocr: { detectText: detectTextMock },
}));
vi.mock('@/core/ocr/cameraCapture', () => ({
  clearImageData: clearImageDataMock,
  blobToDataUrl: vi.fn(() => Promise.resolve('data:image/png;base64,AAAA')),
}));

import { NativeBoundingBoxOcrProvider } from '@/core/ocr/nativeBoundingBoxOcrProvider';

describe('NativeBoundingBoxOcrProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativeAndroidAppMock.mockReturnValue(true);
  });

  describe('isAvailable()', () => {
    it('is available on native Android', () => {
      expect(new NativeBoundingBoxOcrProvider().isAvailable()).toBe(true);
    });

    it('is NOT available off native Android', () => {
      isNativeAndroidAppMock.mockReturnValue(false);
      expect(new NativeBoundingBoxOcrProvider().isAvailable()).toBe(false);
    });

    it('does not stream progress', () => {
      expect(new NativeBoundingBoxOcrProvider().streamsProgress).toBe(false);
    });
  });

  describe('recognize()', () => {
    it('strips the data URL prefix before handing the plugin raw base64', async () => {
      const provider = new NativeBoundingBoxOcrProvider();

      await provider.recognize(() => Promise.resolve(new Blob(['frame'])));

      expect(detectTextMock).toHaveBeenCalledWith({ base64: 'AAAA' });
    });

    it('joins detected text blocks with newlines', async () => {
      const provider = new NativeBoundingBoxOcrProvider();

      const result = await provider.recognize(() => Promise.resolve(new Blob(['frame'])));

      expect(result.text).toBe('user@example.com\nTr0ub4dor&3');
    });

    it('maps each detection to a bounding box with its four corners', async () => {
      const provider = new NativeBoundingBoxOcrProvider();

      const result = await provider.recognize(() => Promise.resolve(new Blob(['frame'])));

      expect(result.boundingBoxes).toEqual([
        { text: 'user@example.com', corners: [[10, 10], [100, 10], [100, 30], [10, 30]] },
        { text: 'Tr0ub4dor&3', corners: [[10, 40], [100, 40], [100, 60], [10, 60]] },
      ]);
    });

    it('never reports an engine confidence (plugin has none)', async () => {
      const provider = new NativeBoundingBoxOcrProvider();

      const result = await provider.recognize(() => Promise.resolve(new Blob(['frame'])));

      expect(result.engineConfidence).toBeUndefined();
    });

    it('returns no bounding boxes when nothing is detected', async () => {
      detectTextMock.mockResolvedValueOnce({ textDetections: [] });
      const provider = new NativeBoundingBoxOcrProvider();

      const result = await provider.recognize(() => Promise.resolve(new Blob(['frame'])));

      expect(result.text).toBe('');
      expect(result.boundingBoxes).toEqual([]);
    });

    it('zeroizes the captured blob after recognition', async () => {
      const provider = new NativeBoundingBoxOcrProvider();
      const blob = new Blob(['secret frame']);

      await provider.recognize(() => Promise.resolve(blob));

      expect(clearImageDataMock).toHaveBeenCalledWith(blob);
    });

    it('still zeroizes the blob when the plugin throws', async () => {
      detectTextMock.mockRejectedValueOnce(new Error('detect failed'));
      const provider = new NativeBoundingBoxOcrProvider();
      const blob = new Blob(['secret frame']);

      await expect(
        provider.recognize(() => Promise.resolve(blob))
      ).rejects.toThrow('detect failed');
      expect(clearImageDataMock).toHaveBeenCalledWith(blob);
    });
  });
});
