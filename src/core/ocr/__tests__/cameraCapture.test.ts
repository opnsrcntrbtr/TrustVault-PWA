/**
 * Camera Capture Tests
 * navigator.mediaDevices and canvas APIs are mocked — no real camera
 * access in tests. Covers support detection, stream lifecycle (stop()
 * halting every track), frame capture, the explicit image-data clearing
 * the module's header comment claims as a security property, and image
 * quality heuristics.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isCameraSupported,
  requestCameraAccess,
  captureFrame,
  clearImageData,
  assessImageQuality,
  enhanceForOcr,
} from '@/core/ocr/cameraCapture';

describe('cameraCapture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('isCameraSupported()', () => {
    it('returns true when mediaDevices.getUserMedia exists', () => {
      vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });

      expect(isCameraSupported()).toBe(true);
    });

    it('returns false when mediaDevices is unavailable', () => {
      vi.stubGlobal('navigator', {});

      expect(isCameraSupported()).toBe(false);
    });
  });

  describe('requestCameraAccess()', () => {
    it('throws when the camera is not supported', async () => {
      vi.stubGlobal('navigator', {});

      await expect(requestCameraAccess()).rejects.toThrow('Camera not supported in this browser');
    });

    it('returns a stream/videoTrack pair, and stop() halts every track', async () => {
      const stopTrack = vi.fn();
      const fakeTrack = { stop: stopTrack };
      const fakeStream = {
        getVideoTracks: () => [fakeTrack],
        getTracks: () => [fakeTrack],
      };
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
      });

      const result = await requestCameraAccess();
      result.stop();

      expect(result.videoTrack).toBe(fakeTrack);
      expect(stopTrack).toHaveBeenCalledTimes(1);
    });

    it('stops any acquired tracks and throws when there is no video track', async () => {
      const stopTrack = vi.fn();
      const fakeStream = {
        getVideoTracks: () => [],
        getTracks: () => [{ stop: stopTrack }],
      };
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
      });

      await expect(requestCameraAccess()).rejects.toThrow('No video track available');
      expect(stopTrack).toHaveBeenCalledTimes(1);
    });

    it('requests the environment-facing camera at 1080p ideal resolution', async () => {
      const fakeTrack = { stop: vi.fn() };
      const fakeStream = { getVideoTracks: () => [fakeTrack], getTracks: () => [fakeTrack] };
      const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
      vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

      await requestCameraAccess();

      expect(getUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    });
  });

  describe('captureFrame()', () => {
    it('throws when the video element has no dimensions yet', async () => {
      const videoElement = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;

      await expect(captureFrame(videoElement)).rejects.toThrow('Video not ready for capture');
    });

    it('draws the video frame to a canvas and resolves with blob/width/height', async () => {
      const videoElement = { videoWidth: 800, videoHeight: 600 } as HTMLVideoElement;
      const fakeBlob = new Blob(['fake'], { type: 'image/png' });
      const drawImage = vi.fn();
      const clearRect = vi.fn();
      const toBlob = vi.fn((cb: (b: Blob | null) => void) => { cb(fakeBlob); });
      vi.spyOn(document, 'createElement').mockReturnValue({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage, clearRect }),
        toBlob,
      } as unknown as HTMLCanvasElement);

      const result = await captureFrame(videoElement);

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.blob).toBe(fakeBlob);
      expect(drawImage).toHaveBeenCalledWith(videoElement, 0, 0, 800, 600);
      expect(clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('rejects when the canvas cannot produce a blob', async () => {
      const videoElement = { videoWidth: 800, videoHeight: 600 } as HTMLVideoElement;
      const toBlob = vi.fn((cb: (b: Blob | null) => void) => { cb(null); });
      vi.spyOn(document, 'createElement').mockReturnValue({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn(), clearRect: vi.fn() }),
        toBlob,
      } as unknown as HTMLCanvasElement);

      await expect(captureFrame(videoElement)).rejects.toThrow('Failed to create image blob');
    });
  });

  describe('enhanceForOcr()', () => {
    // RGBA pixels: one dark (luminance 50), one light (luminance 200).
    // Contrast stretch should map the darkest to 0 and lightest to 255.
    const pixel = (v: number) => [v, v, v, 255];

    it('converts to grayscale (R=G=B per pixel)', () => {
      const data = new Uint8ClampedArray([10, 120, 240, 255, 240, 120, 10, 255]);

      enhanceForOcr(data);

      expect(data[0]).toBe(data[1]);
      expect(data[1]).toBe(data[2]);
      expect(data[4]).toBe(data[5]);
      expect(data[5]).toBe(data[6]);
    });

    it('stretches contrast so the darkest pixel is 0 and the lightest is 255', () => {
      const data = new Uint8ClampedArray([...pixel(50), ...pixel(200)]);

      enhanceForOcr(data);

      expect(data[0]).toBe(0); // darkest → black
      expect(data[4]).toBe(255); // lightest → white
    });

    it('preserves the alpha channel', () => {
      const data = new Uint8ClampedArray([...pixel(50), ...pixel(200)]);

      enhanceForOcr(data);

      expect(data[3]).toBe(255);
      expect(data[7]).toBe(255);
    });

    it('does not divide by zero on a flat (single-luminance) image', () => {
      const data = new Uint8ClampedArray([...pixel(128), ...pixel(128)]);

      expect(() => { enhanceForOcr(data); }).not.toThrow();
    });
  });

  describe('clearImageData()', () => {
    it('zero-fills the blob bytes without throwing', async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3, 4])]);

      await expect(clearImageData(blob)).resolves.toBeUndefined();
    });

    it('does not throw even if reading the blob fails', async () => {
      const brokenBlob = {
        arrayBuffer: () => Promise.reject(new Error('already collected')),
      } as unknown as Blob;

      await expect(clearImageData(brokenBlob)).resolves.toBeUndefined();
    });
  });

  describe('assessImageQuality()', () => {
    it('scores a high-resolution, normal-aspect-ratio frame at 1.0 with no issues', () => {
      const videoElement = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement;

      const result = assessImageQuality(videoElement);

      expect(result.score).toBe(1);
      expect(result.issues).toEqual([]);
    });

    it('penalizes and flags low resolution', () => {
      const videoElement = { videoWidth: 320, videoHeight: 240 } as HTMLVideoElement;

      const result = assessImageQuality(videoElement);

      expect(result.score).toBeLessThan(1);
      expect(result.issues).toContain('Low resolution - move closer or use better lighting');
    });

    it('penalizes and flags an unusual aspect ratio', () => {
      const videoElement = { videoWidth: 2000, videoHeight: 400 } as HTMLVideoElement;

      const result = assessImageQuality(videoElement);

      expect(result.issues).toContain('Unusual aspect ratio - ensure document is fully visible');
    });

    it('never returns a negative score', () => {
      const videoElement = { videoWidth: 100, videoHeight: 5000 } as HTMLVideoElement;

      const result = assessImageQuality(videoElement);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
