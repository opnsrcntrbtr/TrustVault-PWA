/**
 * TrustVault OCR Module - Public API
 */

export {
  recognizeText,
  terminateWorker,
  isOCRSupported,
  prefetchTesseractAssets,
  type OCRProgress,
} from './tesseractService';

export {
  parseCredentialText,
  sanitizeValue,
  type ParsedCredential,
} from './credentialParser';

export {
  isCameraSupported,
  requestCameraAccess,
  captureFrame,
  clearImageData,
  assessImageQuality,
  type CaptureResult,
  type CameraStream,
} from './cameraCapture';
