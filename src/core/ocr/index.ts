// Public API — Safe for external use
export {
  isCameraSupported,
  captureFrame,
  clearImageData,
} from './cameraCapture';

export {
  initializeWorker,
  getWorker,
  recognizeText,
  terminateWorker,
} from './tesseractService';

export {
  parseCredentialText,
  mergeExtractedFields,
} from './credentialParser';

// Types — Safe for external use
export type {
  CameraStream,
  CaptureResult,
  CameraScanDialogProps,
  ScanState,
  ParsedCredential,
  RecognizeResult,
  WorkerOptions,
} from './types';
