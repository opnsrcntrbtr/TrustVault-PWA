/**
 * AI Assistance (Experimental) settings section.
 * Chrome built-in on-device AI only — desktop Chrome only, not supported on Android/iOS.
 * Master toggle is disabled (and stays off) when availability === 'unavailable'.
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Typography, FormControlLabel, Switch, Paper, TextField, Button, LinearProgress } from '@mui/material';
import { loadAiSettings, saveAiSettings, type AiSettings } from '@/core/ai/aiSettings';
import { getAiAvailability } from '@/core/ai/aiAvailability';
import type { AiAvailability } from '@/core/ai/aiTypes';
import { getActiveProvider } from '@/core/ai/providers/registry';
import { webllmProvider, removeWebllmModel } from '@/core/ai/providers/webllmProvider';
import { isMobileAiSurfaceEnabled } from '@/core/ai/providers/capabilities';
import { WEBLLM_MODELS, getModelById } from '@/core/ai/webllmModels';

const AVAILABILITY_TEXT: Record<AiAvailability, string> = {
  available: 'On-device AI: available',
  downloadable: 'On-device AI: enable it in your browser first',
  downloading: 'On-device AI: downloading in your browser…',
  unavailable: 'On-device AI: not available in this browser',
};

export default function AiAssistanceSettings() {
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [availability, setAvailability] = useState<AiAvailability>('unavailable');
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    let mounted = true;
    getAiAvailability()
      .then((a) => { if (mounted) setAvailability(a); })
      .catch(() => { if (mounted) setAvailability('unavailable'); });
    getActiveProvider()
      .then((p) => { if (mounted) setActiveProviderId(p?.id ?? null); })
      .catch(() => { if (mounted) setActiveProviderId(null); });
    return () => { mounted = false; mountedRef.current = false; };
  }, []);

  const update = (patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  };

  const handleDownload = () => {
    setDownloading(true);
    setDownloadProgress(0);
    webllmProvider
      .ensureReady((p) => { if (mountedRef.current) setDownloadProgress(p.progress); })
      .then(() => { update({ mobileAiModelReady: true }); })
      .catch(() => { /* leave mobileAiModelReady false; user can retry */ })
      .finally(() => { if (mountedRef.current) setDownloading(false); });
  };

  const handleRemove = () => {
    removeWebllmModel()
      .then(() => { update({ mobileAiModelReady: false }); })
      .catch(() => { /* best-effort */ });
  };

  const showWebllmBlock = isMobileAiSurfaceEnabled() && activeProviderId === 'webllm';
  const selectedModel = getModelById(settings.webLlmModelId);

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>AI Assistance (Experimental)</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {AVAILABILITY_TEXT[availability]}
      </Typography>

      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={settings.enableOnDeviceAI}
              disabled={availability === 'unavailable'}
              onChange={(e) => {
                update(
                  e.target.checked
                    ? { enableOnDeviceAI: true }
                    : { enableOnDeviceAI: false, allowStrengthExplanation: false, allowBreachImpactAnalysis: false },
                );
              }}
            />
          }
          label="Enable on-device AI (Requires Chrome built-in, currently supported only on a Desktop and not mobile devices)"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: 1 }}>
          Uses your browser's on-device model. TrustVault never sends your passwords or secrets, and never downloads a model for you.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.allowStrengthExplanation}
              disabled={!settings.enableOnDeviceAI || availability === 'unavailable'}
              onChange={(e) => { update({ allowStrengthExplanation: e.target.checked }); }}
            />
          }
          label="Allow AI to explain password strength"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: 1 }}>
          AI receives only the strength rating and entropy estimate — never your password.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.allowBreachImpactAnalysis}
              disabled={!settings.enableOnDeviceAI || availability === 'unavailable'}
              onChange={(e) => { update({ allowBreachImpactAnalysis: e.target.checked }); }}
            />
          }
          label="Allow AI to explain breach impact and remediation"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
          AI receives only public breach data and credential metadata (like username and category) — never your password or notes.
        </Typography>
      </Box>

      {showWebllmBlock && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>On-device AI model (Android)</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Downloads once from a third-party AI CDN. After that, all analysis runs locally on your device — your data never leaves it.
          </Typography>

          <TextField
            select
            slotProps={{ select: { native: true } }}
            label="On-device model"
            value={settings.webLlmModelId}
            onChange={(e) => { update({ webLlmModelId: e.target.value }); }}
            size="small"
            sx={{ mb: 1, minWidth: 240, display: 'block' }}
          >
            {WEBLLM_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </TextField>

          {downloading && (
            <LinearProgress
              variant="determinate"
              value={downloadProgress * 100}
              sx={{ mb: 1 }}
            />
          )}

          {!settings.mobileAiModelReady && (
            <Button variant="outlined" size="small" disabled={downloading} onClick={handleDownload}>
              Download model (~{selectedModel?.approxMB ?? 0} MB)
            </Button>
          )}
          {settings.mobileAiModelReady && (
            <Button variant="outlined" size="small" color="error" onClick={handleRemove}>
              Remove model
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
}
