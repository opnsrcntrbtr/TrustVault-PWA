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
} from './ocrProvider';
export { NativeMlKitOcrProvider } from './nativeMlKitOcrProvider';

// Credential Parser
export {
  parseCredentialText,
  sanitizeValue,
  type ParsedCredential,
} from './credentialParser';
