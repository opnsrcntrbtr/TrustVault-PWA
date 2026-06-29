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

// OCR Provider seam (engine abstraction — native Android ML Kit + Tesseract)
export {
  TesseractOcrProvider,
  getOcrProviders,
  getActiveOcrProvider,
  type OcrProvider,
  type OcrRecognition,
  type OcrBoundingBox,
} from './ocrProvider';
export { NativeMlKitOcrProvider } from './nativeMlKitOcrProvider';
export { NativeBoundingBoxOcrProvider } from './nativeBoundingBoxOcrProvider';

// OCR settings (Phase 4 — bounding-box overlay toggle, experimental, off by default)
export {
  loadOcrSettings,
  saveOcrSettings,
  DEFAULT_OCR_SETTINGS,
  type OcrSettings,
} from './ocrSettings';

// Credential Parser
export {
  parseCredentialText,
  sanitizeValue,
  type ParsedCredential,
} from './credentialParser';
