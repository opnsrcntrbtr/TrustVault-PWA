// Camera Capture API
export {
  requestCameraAccess,
  captureFrame,
  clearImageData,
  assessImageQuality,
  isCameraSupported,
  type CameraStream,
  type CaptureResult,
} from './cameraCapture';

// Tesseract OCR Service
export {
  recognizeText,
  terminateWorker,
  prefetchTesseractAssets,
  type OCRProgress,
  type OcrMode,
} from './tesseractService';

// OCR Provider seam (engine abstraction — Tesseract today, native Android later)
export {
  TesseractOcrProvider,
  getOcrProviders,
  getActiveOcrProvider,
  type OcrProvider,
  type OcrRecognition,
} from './ocrProvider';

// Credential Parser
export {
  parseCredentialText,
  sanitizeValue,
  type ParsedCredential,
} from './credentialParser';
