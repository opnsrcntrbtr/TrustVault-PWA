/**
 * CameraScanDialog
 *
 * Full-screen modal for capturing credential information via device camera.
 * Displays live camera feed with guidance overlay, quality feedback, and capture controls.
 *
 * Security:
 * - All image processing is local-only (Tesseract.js)
 * - Image buffers are cleared immediately after OCR
 * - No images are persisted to disk or network
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Button,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CameraAltIcon from '@mui/icons-material/CameraAlt';

import {
  requestCameraAccess,
  captureFrame,
  assessImageQuality,
  parseCredentialText,
  terminateWorker,
  isCameraSupported,
  getActiveOcrProvider,
  loadOcrSettings,
  type CameraStream,
  type ParsedCredential,
  type OCRProgress,
  type OcrBoundingBox,
} from '@/core/ocr';

/** Frozen-frame bounding-box preview shown when the overlay toggle is on
 *  (Phase 4). The plugin behind this does single-shot detection, not live
 *  streaming, so the "overlay" is a brief post-capture review rather than a
 *  continuous video overlay — documented in docs/OCR_NATIVE_ANDROID_PLAN.md. */
interface OverlayPreview {
  imageUrl: string;
  boxes: OcrBoundingBox[];
  width: number;
  height: number;
  parsed: ParsedCredential;
}

/** How long the bounding-box review is shown before auto-continuing. */
const OVERLAY_AUTO_CONTINUE_MS = 1800;

export interface CameraScanDialogProps {
  open: boolean;
  onClose: () => void;
  onResult: (result: ParsedCredential) => void;
}

type ScanState =
  | 'idle'
  | 'requesting'
  | 'streaming'
  | 'capturing'
  | 'processing'
  | 'overlay'
  | 'error';

export function CameraScanDialog({
  open,
  onClose,
  onResult,
}: CameraScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<CameraStream | null>(null);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [qualityIssues, setQualityIssues] = useState<string[]>([]);
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null);
  const [overlayPreview, setOverlayPreview] = useState<OverlayPreview | null>(null);

  // Start camera when dialog opens
  useEffect(() => {
    if (!open) return;

    let mounted = true;

    async function initCamera() {
      if (!isCameraSupported()) {
        setScanState('error');
        setErrorMessage('Camera not supported in this browser');
        return;
      }

      setScanState('requesting');
      setErrorMessage('');

      try {
        const stream = await requestCameraAccess();

        if (!mounted) {
          stream.stop();
          return;
        }

        cameraStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream.stream;
          await videoRef.current.play();
        }

        setScanState('streaming');
      } catch (err) {
        if (!mounted) return;

        setScanState('error');
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setErrorMessage(
              'Camera access denied. Please allow camera access in your browser settings.'
            );
          } else if (err.name === 'NotFoundError') {
            setErrorMessage('No camera found on this device.');
          } else {
            setErrorMessage(err.message);
          }
        } else {
          setErrorMessage('Failed to access camera');
        }
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (cameraStreamRef.current) {
        cameraStreamRef.current.stop();
        cameraStreamRef.current = null;
      }
    };
  }, [open]);

  // Clean up on close
  useEffect(() => {
    if (!open) {
      setScanState('idle');
      setErrorMessage('');
      setQualityIssues([]);
      setOcrProgress(null);
      setOverlayPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev.imageUrl);
        return null;
      });

      if (cameraStreamRef.current) {
        cameraStreamRef.current.stop();
        cameraStreamRef.current = null;
      }
    }
  }, [open]);

  // Update quality assessment periodically
  useEffect(() => {
    if (scanState !== 'streaming' || !videoRef.current) return;

    const interval = setInterval(() => {
      if (videoRef.current) {
        const { issues } = assessImageQuality(videoRef.current);
        setQualityIssues(issues);
      }
    }, 1000);

    return () => { clearInterval(interval); };
  }, [scanState]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || scanState !== 'streaming') return;

    setScanState('capturing');

    const video = videoRef.current;

    try {
      // Capture once so a single frame backs both recognition and (if the
      // overlay toggle is on) the bounding-box review — the provider still
      // owns zeroizing it once recognition completes.
      const frame = await captureFrame(video);
      const provider = getActiveOcrProvider();

      setScanState('processing');
      setOcrProgress({ status: 'initializing', progress: 0 });

      const { text, engineConfidence, boundingBoxes } = await provider.recognize(
        () => Promise.resolve(frame.blob),
        provider.streamsProgress ? setOcrProgress : undefined
      );

      if (text.trim().length === 0) {
        setScanState('error');
        setErrorMessage(
          'No text detected. Please position the credential information clearly in the frame.'
        );
        return;
      }

      const parsed = parseCredentialText(text);
      if (engineConfidence != null) {
        parsed.confidence.overall =
          (parsed.confidence.overall + engineConfidence) / 2;
      }

      // Experimental overlay (Phase 4, off by default): briefly show the
      // detected text blocks over the captured frame before continuing.
      if (boundingBoxes?.length && loadOcrSettings().ocrShowBoundingBoxOverlay) {
        setOverlayPreview({
          imageUrl: URL.createObjectURL(frame.blob),
          boxes: boundingBoxes,
          width: frame.width,
          height: frame.height,
          parsed,
        });
        setScanState('overlay');
        return;
      }

      onResult(parsed);
      onClose();
    } catch (err) {
      setScanState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to process image'
      );
    }
  }, [scanState, onResult, onClose]);

  const finishOverlay = useCallback(() => {
    setOverlayPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.imageUrl);
        onResult(prev.parsed);
      }
      return null;
    });
    onClose();
  }, [onResult, onClose]);

  // Auto-continue the bounding-box review after a brief pause.
  useEffect(() => {
    if (scanState !== 'overlay') return;
    const timeout = setTimeout(finishOverlay, OVERLAY_AUTO_CONTINUE_MS);
    return () => { clearTimeout(timeout); };
  }, [scanState, finishOverlay]);

  const handleClose = useCallback(() => {
    // Ensure cleanup before closing
    terminateWorker().catch(() => {});
    onClose();
  }, [onClose]);

  const handleRetry = useCallback(() => {
    setScanState('idle');
    setErrorMessage('');
    // Re-trigger camera init via useEffect
    if (cameraStreamRef.current) {
      cameraStreamRef.current.stop();
      cameraStreamRef.current = null;
    }
    // Small delay then reset to trigger effect
    setTimeout(() => { setScanState('requesting'); }, 100);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      PaperProps={{
        sx: { bgcolor: 'black' },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: 'rgba(0,0,0,0.8)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 1,
        }}
      >
        <Typography variant="h6">Scan Credential</Typography>
        <IconButton onClick={handleClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'black',
          position: 'relative',
        }}
      >
        {/* Video feed */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 600,
            aspectRatio: '4/3',
            bgcolor: '#111',
            borderRadius: 2,
            overflow: 'hidden',
            mx: 'auto',
            my: 2,
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: scanState === 'streaming' ? 'block' : 'none',
            }}
          />

          {/* Viewfinder overlay */}
          {scanState === 'streaming' && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                border: '2px dashed rgba(255,255,255,0.5)',
                borderRadius: 2,
                m: 2,
                pointerEvents: 'none',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: 'rgba(255,255,255,0.8)',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  px: 1,
                  borderRadius: 1,
                }}
              >
                Position credential info in frame
              </Typography>
            </Box>
          )}

          {/* Loading states */}
          {scanState === 'requesting' && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <CircularProgress color="inherit" />
              <Typography sx={{ mt: 2 }}>Requesting camera access...</Typography>
            </Box>
          )}

          {scanState === 'capturing' && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.3)',
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {scanState === 'processing' && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.8)',
                color: 'white',
              }}
            >
              <CircularProgress color="inherit" />
              <Typography sx={{ mt: 2 }}>
                {ocrProgress?.status || 'Processing...'}
              </Typography>
              {ocrProgress && (
                <LinearProgress
                  variant="determinate"
                  value={ocrProgress.progress * 100}
                  sx={{ width: '60%', mt: 1 }}
                />
              )}
              <Typography variant="caption" sx={{ mt: 1, opacity: 0.7 }}>
                Processing locally on your device
              </Typography>
            </Box>
          )}

          {/* Experimental bounding-box overlay (Phase 4, off by default) —
              single-shot detection review, not a live video overlay. */}
          {scanState === 'overlay' && overlayPreview && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'black',
              }}
            >
              <svg
                viewBox={`0 0 ${String(overlayPreview.width)} ${String(overlayPreview.height)}`}
                style={{ width: '100%', height: '100%', display: 'block' }}
                role="img"
                aria-label="Detected text regions"
              >
                <image
                  href={overlayPreview.imageUrl}
                  width={overlayPreview.width}
                  height={overlayPreview.height}
                />
                {overlayPreview.boxes.map((box, i) => (
                  <polygon
                    key={`${box.text}-${String(i)}`}
                    points={box.corners.map(([x, y]) => `${String(x)},${String(y)}`).join(' ')}
                    fill="rgba(76, 175, 80, 0.15)"
                    stroke="#4caf50"
                    strokeWidth={Math.max(1, overlayPreview.width / 400)}
                  />
                ))}
              </svg>
              <Button
                size="small"
                variant="contained"
                onClick={finishOverlay}
                sx={{ position: 'absolute', bottom: 12, right: 12 }}
              >
                Continue
              </Button>
            </Box>
          )}
        </Box>

        {/* Quality feedback */}
        {scanState === 'streaming' && qualityIssues.length > 0 && (
          <Alert severity="warning" sx={{ mx: 2, mb: 2, maxWidth: 560 }}>
            {qualityIssues.join('. ')}
          </Alert>
        )}

        {/* Error state */}
        {scanState === 'error' && (
          <Alert
            severity="error"
            sx={{ mx: 2, mb: 2, maxWidth: 560 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            }
          >
            {errorMessage}
          </Alert>
        )}

        {/* Capture controls */}
        {scanState === 'streaming' && (
          <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<CameraAltIcon />}
              onClick={handleCapture}
              sx={{
                borderRadius: '50px',
                px: 4,
                py: 1.5,
              }}
            >
              Capture
            </Button>
          </Box>
        )}

        {/* Privacy notice */}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
          }}
        >
          🔒 Images are processed locally and never uploaded
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
