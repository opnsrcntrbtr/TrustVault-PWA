/**
 * Clipboard Settings Component
 * Configure clipboard auto-clear behavior
 */

import { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import { ContentCopy, Timer, Warning } from '@mui/icons-material';

interface ClipboardSettingsProps {
  clipboardClearSeconds: number;
  onSave: (seconds: number) => void;
}

const TIMEOUT_OPTIONS = [
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds (recommended)' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 0, label: 'Never (not recommended)' },
];

export default function ClipboardSettings({
  clipboardClearSeconds,
  onSave,
}: ClipboardSettingsProps) {
  const [timeout, setTimeout] = useState(clipboardClearSeconds);

  const handleChange = (value: number) => {
    setTimeout(value);
    onSave(value);
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ContentCopy color="primary" />
        <Typography variant="h6">Clipboard Auto-Clear</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Automatically clear sensitive data from clipboard after a specified duration to protect your credentials.
      </Typography>

      {/* Timeout Selector */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="clipboard-timeout-label">Auto-clear timeout</InputLabel>
        <Select
          labelId="clipboard-timeout-label"
          value={timeout}
          label="Auto-clear timeout"
          onChange={(e) => { handleChange(Number(e.target.value)); }}
        >
          {TIMEOUT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Warning for "Never" setting */}
      {timeout === 0 && (
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Security Warning
          </Typography>
          <Typography variant="caption">
            Disabling auto-clear is not recommended. Sensitive data will remain in your clipboard
            indefinitely, which could expose your credentials if someone gains access to your device.
          </Typography>
        </Alert>
      )}

      {/* Info box */}
      <Alert severity="info" icon={<Timer />}>
        <Typography variant="caption">
          When you copy passwords or other sensitive data, a countdown notification will appear
          showing the remaining time before the clipboard is automatically cleared.
        </Typography>
      </Alert>

      {/* Current Status */}
      <Box sx={{ mt: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          Current Setting:
        </Typography>
        <Typography variant="body2">
          • Auto-clear after:{' '}
          <strong>
            {timeout === 0 ? 'Never' : `${timeout} second${timeout !== 1 ? 's' : ''}`}
          </strong>
        </Typography>
      </Box>
    </Paper>
  );
}
