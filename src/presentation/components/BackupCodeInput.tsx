import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Typography,
} from '@mui/material';
import { validateBackupCode, normalizeBackupCode } from '@/core/auth/backupCodes';
import type { BackupCode } from '@/domain/entities/Credential';

export interface BackupCodeInputProps {
  credentialTitle: string;
  backupCodes: BackupCode[];
  onSuccess: (consumedCode: BackupCode) => void;
  onCancel: () => void;
}

export default function BackupCodeInput({
  credentialTitle,
  backupCodes,
  onSuccess,
  onCancel,
}: BackupCodeInputProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCode(value);
    setError(null); // Clear error on change
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Enter a backup code');
      return;
    }

    if (!validateBackupCode(code)) {
      setError('Code must be 8 digits');
      return;
    }

    setLoading(true);

    try {
      const normalized = normalizeBackupCode(code);

      // Check if code exists
      const found = backupCodes.find((bc) => bc.code === normalized);
      if (!found) {
        setError('This code doesn\'t exist');
        setLoading(false);
        return;
      }

      // Check if already consumed
      if (found.consumed) {
        const dateUsed = found.lastUsedAt
          ? new Date(found.lastUsedAt).toLocaleDateString()
          : 'unknown date';
        setError(`This code was already used on ${dateUsed}`);
        setLoading(false);
        return;
      }

      // Code is valid and not consumed
      onSuccess(found);
    } catch (err) {
      console.error('Error verifying backup code:', err);
      setError('Failed to verify code, try again');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && code.trim()) {
      handleSubmit();
    }
  };

  return (
    <Dialog open maxWidth="sm" fullWidth>
      <DialogTitle>Recover access to "{credentialTitle}"</DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Enter one of your backup codes to regain access without your authenticator.
          </Typography>
        </Alert>

        <TextField
          autoFocus
          fullWidth
          placeholder="e.g., 12345678"
          value={code}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          error={!!error}
          helperText={error}
          inputProps={{ maxLength: 9 }} // 8 digits + 1 space
          sx={{ mb: 1 }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!code.trim() || loading}
        >
          {loading ? 'Verifying...' : 'Use this code'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
