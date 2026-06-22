/**
 * AI Assistance (Experimental) settings section.
 * Chrome built-in on-device AI (desktop) plus an Android on-device A/B
 * between LiteRT-LM and WebLLM. Master toggle is disabled (and stays off)
 * when availability === 'unavailable'.
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Typography, FormControlLabel, Switch, Paper, TextField, Button, LinearProgress } from '@mui/material';
import type { ChatScope } from '@/core/ai/chat/chatTypes';
import { loadAiSettings, saveAiSettings, type AiSettings } from '@/core/ai/aiSettings';
import { getAiAvailability } from '@/core/ai/aiAvailability';
import type { AiAvailability } from '@/core/ai/aiTypes';
import { getActiveProvider } from '@/core/ai/providers/registry';
import { webllmProvider, removeWebllmModel } from '@/core/ai/providers/webllmProvider';
import { litertProvider, removeLitertModel } from '@/core/ai/providers/litertProvider';
import { isMobileAiSurfaceEnabled, isLitertEnabled, isWebllmEnabled } from '@/core/ai/providers/capabilities';
import { WEBLLM_MODELS, getModelById } from '@/core/ai/webllmModels';
import { LITERT_MODELS, getLitertModelById } from '@/core/ai/litertModels';

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
    const onProgress = (p: { progress: number }) => { if (mountedRef.current) setDownloadProgress(p.progress); };
    const ready = settings.mobileInferenceEngine === 'litert-lm'
      ? litertProvider.ensureReady(onProgress).then(() => { update({ litertModelReady: true }); })
      : webllmProvider.ensureReady(onProgress).then(() => { update({ mobileAiModelReady: true }); });
    ready
      .catch(() => { /* leave the ready flag false; user can retry */ })
      .finally(() => { if (mountedRef.current) setDownloading(false); });
  };

  const handleRemove = () => {
    const removed = settings.mobileInferenceEngine === 'litert-lm'
      ? removeLitertModel().then(() => { update({ litertModelReady: false }); })
      : removeWebllmModel().then(() => { update({ mobileAiModelReady: false }); });
    removed.catch(() => { /* best-effort */ });
  };

  const bothEnginesEnabled = isLitertEnabled() && isWebllmEnabled();
  const showMobileBlock = isMobileAiSurfaceEnabled() && (activeProviderId === 'webllm' || activeProviderId === 'litert-lm');
  const isLitertEngine = settings.mobileInferenceEngine === 'litert-lm';
  const selectedWebllmModel = getModelById(settings.webLlmModelId);
  const selectedLitertModel = getLitertModelById(settings.litertModelId);
  const modelReady = isLitertEngine ? settings.litertModelReady : settings.mobileAiModelReady;
  const approxMB = isLitertEngine ? selectedLitertModel?.approxMB : selectedWebllmModel?.approxMB;

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
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: 1 }}>
          AI receives only public breach data and credential metadata (like username and category) — never your password or notes.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.allowChatFollowUp}
              disabled={!settings.enableOnDeviceAI || availability === 'unavailable'}
              onChange={(e) => { update({ allowChatFollowUp: e.target.checked }); }}
            />
          }
          label="Follow-up chat"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: 1 }}>
          Chat stays on your device; history is cleared when you close it or lock the vault.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.enableGeneralAssistant}
              disabled={!settings.enableOnDeviceAI || availability === 'unavailable'}
              onChange={(e) => { update({ enableGeneralAssistant: e.target.checked }); }}
            />
          }
          label="General assistant"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: 1 }}>
          Adds a standalone assistant you can open anytime to ask security questions.
        </Typography>

        <TextField
          select
          slotProps={{ select: { native: true } }}
          label="Assistant default scope"
          value={settings.generalAssistantDefaultScope}
          disabled={!settings.enableGeneralAssistant || !settings.enableOnDeviceAI || availability === 'unavailable'}
          onChange={(e) => { update({ generalAssistantDefaultScope: e.target.value as ChatScope }); }}
          size="small"
          sx={{ mb: 1, minWidth: 240, display: 'block' }}
        >
          <option value="stateless">Stateless</option>
          <option value="curated">Curated summary</option>
          <option value="per-credential">Per-credential</option>
        </TextField>
      </Box>

      {showMobileBlock && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>On-device AI model (Android)</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Downloads once from a third-party AI CDN. After that, all analysis runs locally on your device — your data never leaves it.
          </Typography>

          {bothEnginesEnabled && (
            <TextField
              select
              slotProps={{ select: { native: true } }}
              label="Inference engine"
              value={settings.mobileInferenceEngine}
              onChange={(e) => { update({ mobileInferenceEngine: e.target.value as AiSettings['mobileInferenceEngine'] }); }}
              size="small"
              sx={{ mb: 1, minWidth: 240, display: 'block' }}
            >
              <option value="litert-lm">LiteRT-LM (recommended)</option>
              <option value="webllm">WebLLM</option>
            </TextField>
          )}

          {isLitertEngine ? (
            <TextField
              select
              slotProps={{ select: { native: true } }}
              label="On-device model"
              value={settings.litertModelId}
              onChange={(e) => { update({ litertModelId: e.target.value }); }}
              size="small"
              sx={{ mb: 1, minWidth: 240, display: 'block' }}
            >
              {LITERT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </TextField>
          ) : (
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
          )}

          {downloading && (
            <LinearProgress
              variant="determinate"
              value={downloadProgress * 100}
              sx={{ mb: 1 }}
            />
          )}

          {!modelReady && (
            <Button variant="outlined" size="small" disabled={downloading} onClick={handleDownload}>
              Download model (~{approxMB ?? 0} MB)
            </Button>
          )}
          {modelReady && (
            <Button variant="outlined" size="small" color="error" onClick={handleRemove}>
              Remove model
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
}
