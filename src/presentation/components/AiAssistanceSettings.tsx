/**
 * AI Assistance (Experimental) settings section.
 * Chrome built-in on-device AI only. Both toggles off by default.
 */
import { useEffect, useState } from 'react';
import { Box, Typography, FormControlLabel, Switch, Paper } from '@mui/material';
import { loadAiSettings, saveAiSettings, type AiSettings } from '@/core/ai/aiSettings';
import { getAiAvailability } from '@/core/ai/aiAvailability';
import type { AiAvailability } from '@/core/ai/aiTypes';

const AVAILABILITY_TEXT: Record<AiAvailability, string> = {
  available: 'On-device AI: available',
  downloadable: 'On-device AI: enable it in your browser first',
  downloading: 'On-device AI: downloading in your browser…',
  unavailable: 'On-device AI: not available in this browser',
};

export default function AiAssistanceSettings() {
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [availability, setAvailability] = useState<AiAvailability>('unavailable');

  useEffect(() => {
    let mounted = true;
    getAiAvailability()
      .then((a) => { if (mounted) setAvailability(a); })
      .catch(() => { if (mounted) setAvailability('unavailable'); });
    return () => { mounted = false; };
  }, []);

  const update = (patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  };

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
              onChange={(e) =>
                update(
                  e.target.checked
                    ? { enableOnDeviceAI: true }
                    : { enableOnDeviceAI: false, allowStrengthExplanation: false },
                )
              }
            />
          }
          label="Enable on-device AI (Chrome built-in, where available)"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: 1 }}>
          Uses your browser's on-device model. TrustVault never sends your passwords or secrets, and never downloads a model for you.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.allowStrengthExplanation}
              disabled={!settings.enableOnDeviceAI}
              onChange={(e) => update({ allowStrengthExplanation: e.target.checked })}
            />
          }
          label="Allow AI to explain password strength"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
          AI receives only the strength rating and entropy estimate — never your password.
        </Typography>
      </Box>
    </Paper>
  );
}
