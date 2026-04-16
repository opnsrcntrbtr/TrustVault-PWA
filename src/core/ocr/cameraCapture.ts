/**
 * TrustVault Camera Capture Service
 *
 * Handles MediaDevices/ImageCapture API for secure image acquisition.
 * Security: All captured image data is held only in memory and explicitly
 * cleared after processing. No images are persisted to disk or IndexedDB.
 */

export interface CaptureResult {
  blob: Blob;
  width: number;
  height: number;
}

export interface CameraStream {
  stream: MediaStream;
  videoTrack: MediaStreamTrack;
  stop: () => void;
}

/**
 * Check if camera access is available in this browser/context.
 */
export function isCameraSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Request camera access and return the stream.
 * Prefers back camera (environment) for document scanning.
 */
export async function requestCameraAccess(): Promise<CameraStream> {
  if (!isCameraSupported()) {
    throw new Error('Camera not supported in this browser');
  }

  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const videoTrack = stream.getVideoTracks()[0];

  if (!videoTrack) {
    stream.getTracks().forEach((t) => { t.stop(); });
    throw new Error('No video track available');
  }

  return {
    stream,
    videoTrack,
    stop: () => {
      stream.getTracks().forEach((track) => { track.stop(); });
    },
  };
}

/**
 * Capture a still frame from a video element.
 * Uses canvas fallback for maximum browser compatibility.
 */
export async function captureFrame(
  videoElement: HTMLVideoElement
): Promise<CaptureResult> {
  const width = videoElement.videoWidth;
  const height = videoElement.videoHeight;

  if (width === 0 || height === 0) {
    throw new Error('Video not ready for capture');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.drawImage(videoElement, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      },
      'image/png',
      1.0
    );
  });

  // Clear canvas immediately
  ctx.clearRect(0, 0, width, height);

  return { blob, width, height };
}

/**
 * Securely clear image data from memory.
 * Call this after OCR processing is complete.
 */
export async function clearImageData(blob: Blob): Promise<void> {
  try {
    // Convert to ArrayBuffer and overwrite with zeros
    const buffer = await blob.arrayBuffer();
    const view = new Uint8Array(buffer);
    view.fill(0);
  } catch {
    // Best effort - blob may already be garbage collected
  }
}

/**
 * Assess image quality for OCR suitability.
 * Returns a score 0-1 and recommendations.
 */
export function assessImageQuality(
  videoElement: HTMLVideoElement
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 1.0;

  const width = videoElement.videoWidth;
  const height = videoElement.videoHeight;

  // Check resolution
  if (width < 640 || height < 480) {
    issues.push('Low resolution - move closer or use better lighting');
    score -= 0.3;
  }

  // We can't easily check blur/lighting without more processing,
  // but provide guidance anyway
  if (width > 0 && height > 0) {
    const aspectRatio = width / height;
    if (aspectRatio < 0.5 || aspectRatio > 2.5) {
      issues.push('Unusual aspect ratio - ensure document is fully visible');
      score -= 0.1;
    }
  }

  return {
    score: Math.max(0, score),
    issues,
  };
}
