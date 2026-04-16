/**
 * UnlockDialog Component
 * Prompts user to re-enter master password to unlock vault
 * Used when vault is locked but user is still authenticated
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Lock, Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';

interface UnlockDialogProps {
  open: boolean;
  onClose?: () => void;
}

export default function UnlockDialog({ open, onClose }: UnlockDialogProps) {
  const { user, unlockVault } = useAuthStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const handleUnlock = async () => {
    if (!user) {
      setError('User session not found. Please sign in again.');
      return;
    }

    if (!password) {
      setError('Please enter your master password');
      return;
    }

    setUnlocking(true);
    setError(null);

    try {
      // Authenticate with password to get vault key
      const session = await userRepository.authenticateWithPassword(user.email, password);

      // Unlock vault with the vault key
      unlockVault(session.vaultKey);

      // Clear password from memory
      setPassword('');

      // Close dialog
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Unlock failed:', err);
      setError('Incorrect password. Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !unlocking) {
      handleUnlock();
    }
  };

  const handleClose = () => {
    if (unlocking) return; // Prevent closing during unlock
    setPassword('');
    setError(null);
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown={unlocking}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Lock color="primary" />
          <Typography variant="h6">Vault Locked</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your vault is locked for security. Enter your master password to unlock and access your
          credentials.
        </Typography>

        {user && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Account:</strong> {user.email}
            </Typography>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Master Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => { setPassword(e.target.value); }}
          onKeyPress={handleKeyPress}
          disabled={unlocking}
          autoFocus
          placeholder="Enter your master password"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => { setShowPassword(!showPassword); }}
                  edge="end"
                  disabled={unlocking}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Your master password is never stored and is used only to decrypt your vault.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={unlocking}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleUnlock}
          disabled={!password || unlocking}
          startIcon={unlocking ? <CircularProgress size={16} /> : <Lock />}
        >
          {unlocking ? 'Unlocking...' : 'Unlock Vault'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
