/**
 * Bounding-box OCR overlay (Experimental) settings section — Phase 4.
 * Native-Android-only: hidden on web/iOS since the overlay providers never
 * report available() there. Off by default — see ocrSettings.ts.
 */
import { useState } from 'react';
import { Box, Typography, FormControlLabel, Switch, Paper, Alert } from '@mui/material';
import { isNativeAndroidApp } from '@/core/platform/runtime';
import { loadOcrSettings, saveOcrSettings, type OcrSettings } from '@/core/ocr/ocrSettings';

export default function OcrOverlaySettings() {
  const [settings, setSettings] = useState<OcrSettings>(() => loadOcrSettings());

  if (!isNativeAndroidApp()) {
    return null;
  }

  const update = (patch: Partial<OcrSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveOcrSettings(next);
  };

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Bounding-Box OCR Overlay (Experimental)
      </Typography>

      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={settings.ocrShowBoundingBoxOverlay}
              onChange={(e) => { update({ ocrShowBoundingBoxOverlay: e.target.checked }); }}
            />
          }
          label="Show bounding boxes for detected text after scanning"
        />
      </Box>

      <Alert severity="info" sx={{ mt: 1 }}>
        <Typography variant="caption">
          Briefly highlights where text was detected on the captured frame. Uses a different
          on-device engine (Firebase ML Vision) that does not report a confidence score, so
          field accuracy falls back to TrustVault&apos;s own heuristics. Off by default.
        </Typography>
      </Alert>
    </Paper>
  );
}
