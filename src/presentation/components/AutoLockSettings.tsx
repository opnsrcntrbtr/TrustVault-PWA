/**
 * Auto-Lock Settings Component
 * Configure automatic session locking behavior
 */

import { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Paper,
  Alert,
  Button,
} from '@mui/material';
import { Lock, LockClock, Visibility } from '@mui/icons-material';

interface AutoLockSettingsProps {
  sessionTimeoutMinutes: number;
  lockOnTabHidden?: boolean;
  onSave: (settings: { sessionTimeoutMinutes: number; lockOnTabHidden: boolean }) => void;
}

const TIMEOUT_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes (recommended)' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 0, label: 'Never (not recommended)' },
];

export default function AutoLockSettings({
  sessionTimeoutMinutes,
  lockOnTabHidden = false,
  onSave,
}: AutoLockSettingsProps) {
  const [timeout, setTimeout] = useState(sessionTimeoutMinutes);
  const [lockOnHidden, setLockOnHidden] = useState(lockOnTabHidden);
  const [hasChanges, setHasChanges] = useState(false);

  const handleTimeoutChange = (value: number) => {
    setTimeout(value);
    setHasChanges(true);
  };

  const handleLockOnHiddenChange = (checked: boolean) => {
    setLockOnHidden(checked);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave({
      sessionTimeoutMinutes: timeout,
      lockOnTabHidden: lockOnHidden,
    });
    setHasChanges(false);
  };

  const handleReset = () => {
    setTimeout(sessionTimeoutMinutes);
    setLockOnHidden(lockOnTabHidden);
    setHasChanges(false);
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <LockClock color="primary" />
        <Typography variant="h6">Auto-Lock</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Automatically lock your vault after a period of inactivity to protect your credentials.
      </Typography>

      {/* Session Timeout Selector */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="timeout-select-label">Session Timeout</InputLabel>
        <Select
          labelId="timeout-select-label"
          value={timeout}
          label="Session Timeout"
          onChange={(e) => { handleTimeoutChange(Number(e.target.value)); }}
        >
          {TIMEOUT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Lock on Tab Hidden */}
      <FormControlLabel
        control={
          <Switch
            checked={lockOnHidden}
            onChange={(e) => { handleLockOnHiddenChange(e.target.checked); }}
          />
        }
        label={
          <Box>
            <Typography variant="body2">Lock when tab is hidden</Typography>
            <Typography variant="caption" color="text.secondary">
              Automatically lock vault when you switch to another tab or window
            </Typography>
          </Box>
        }
        sx={{ mb: 2, alignItems: 'flex-start' }}
      />

      {/* Warning for "Never" setting */}
      {timeout === 0 && (
        <Alert severity="warning" icon={<Lock />} sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Security Warning
          </Typography>
          <Typography variant="caption">
            Disabling auto-lock is not recommended. Your credentials will remain unlocked
            indefinitely, which could expose them if you leave your device unattended.
          </Typography>
        </Alert>
      )}

      {/* Info box */}
      <Alert severity="info" icon={<Visibility />} sx={{ mb: 2 }}>
        <Typography variant="caption">
          Activity is tracked through mouse movements, keyboard input, scrolling, and touch events.
          The timer resets with each interaction.
        </Typography>
      </Alert>

      {/* Save/Reset buttons */}
      {hasChanges && (
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button variant="outlined" onClick={handleReset} fullWidth>
            Reset
          </Button>
          <Button variant="contained" onClick={handleSave} fullWidth>
            Save Changes
          </Button>
        </Box>
      )}

      {/* Current Status */}
      <Box sx={{ mt: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          Current Configuration:
        </Typography>
        <Typography variant="body2">
          • Auto-lock after:{' '}
          <strong>
            {timeout === 0 ? 'Never' : `${timeout} minute${timeout !== 1 ? 's' : ''}`}
          </strong>
        </Typography>
        <Typography variant="body2">
          • Lock on tab switch: <strong>{lockOnHidden ? 'Enabled' : 'Disabled'}</strong>
        </Typography>
      </Box>
    </Paper>
  );
}
