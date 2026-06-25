/**
 * Tesseract OCR Service Tests
 * tesseract.js itself is mocked — these tests cover this module's worker
 * lifecycle orchestration (lazy memoized init via recognizeText, teardown
 * via terminateWorker), not OCR accuracy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const recognizeMock = vi.fn(() => Promise.resolve({ data: { text: 'mocked text', confidence: 87 } }));
const setParametersMock = vi.fn(() => Promise.resolve(undefined));
const terminateMock = vi.fn(() => Promise.resolve(undefined));
const createWorkerMock = vi.fn(() => Promise.resolve({
  recognize: recognizeMock,
  setParameters: setParametersMock,
  terminate: terminateMock,
}));

vi.mock('tesseract.js', () => ({
  createWorker: createWorkerMock,
  PSM: { SINGLE_COLUMN: 4 },
}));

import { recognizeText, terminateWorker, isOCRSupported } from '@/core/ocr/tesseractService';

describe('tesseractService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await terminateWorker();
  });

  describe('recognizeText()', () => {
    it('returns the recognized text and confidence from the worker', async () => {
      const blob = new Blob(['fake image bytes'], { type: 'image/png' });

      const result = await recognizeText(blob);

      expect(result.text).toBe('mocked text');
      expect(result.confidence).toBe(87);
    });

    it('creates the worker only once across two calls (memoized singleton)', async () => {
      const blob = new Blob(['fake image bytes'], { type: 'image/png' });

      await recognizeText(blob);
      await recognizeText(blob);

      expect(createWorkerMock).toHaveBeenCalledTimes(1);
    });

    it('configures single-column page segmentation on worker creation', async () => {
      const blob = new Blob(['fake image bytes'], { type: 'image/png' });

      await recognizeText(blob);

      expect(setParametersMock).toHaveBeenCalledWith({ tessedit_pageseg_mode: 4 });
    });

    it('resolves without throwing when an onProgress callback is supplied', async () => {
      const blob = new Blob(['fake image bytes'], { type: 'image/png' });
      const onProgress = vi.fn();

      await expect(recognizeText(blob, onProgress)).resolves.toEqual({
        text: 'mocked text',
        confidence: 87,
      });
    });
  });

  describe('terminateWorker()', () => {
    it('tears down the worker so the next recognizeText() creates a new one', async () => {
      const blob = new Blob(['fake image bytes'], { type: 'image/png' });
      await recognizeText(blob);

      await terminateWorker();
      await recognizeText(blob);

      expect(createWorkerMock).toHaveBeenCalledTimes(2);
      expect(terminateMock).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when no worker has been created yet', async () => {
      await expect(terminateWorker()).resolves.toBeUndefined();
      expect(terminateMock).not.toHaveBeenCalled();
    });
  });

  describe('isOCRSupported()', () => {
    it('returns true when navigator.mediaDevices.getUserMedia exists', () => {
      vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });

      expect(isOCRSupported()).toBe(true);

      vi.unstubAllGlobals();
    });

    it('returns false when mediaDevices is unavailable', () => {
      vi.stubGlobal('navigator', {});

      expect(isOCRSupported()).toBe(false);

      vi.unstubAllGlobals();
    });
  });
});
