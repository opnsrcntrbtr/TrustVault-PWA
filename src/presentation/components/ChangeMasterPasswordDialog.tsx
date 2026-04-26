/**
 * Change Master Password Dialog
 * Allows users to change their master password with re-encryption
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Box,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff, Warning } from '@mui/icons-material';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import { changeMasterPassword } from '@/application/services/authService';
import { useAuthStore } from '../store/authStore';

interface ChangeMasterPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChangeMasterPasswordDialog({
  open,
  onClose,
  onSuccess,
}: ChangeMasterPasswordDialogProps) {
  const { user, logout } = useAuthStore();

  // Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Validation
  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= 12 &&
    newPassword === confirmPassword;

  const handleSubmit = async () => {
    if (!user || !isValid) return;

    setError(null);
    setProcessing(true);

    try {
      await changeMasterPassword(
        user.id,
        currentPassword,
        newPassword
      );

      setProcessing(false);

      // Show success and close
      onSuccess();

      // Sign out after a brief delay
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (err) {
      console.error('Failed to change master password:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to change master password. Please try again.'
      );
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (processing) return; // Don't allow closing during processing
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Change Master Password</DialogTitle>

      <DialogContent>
        {/* Warning Alert */}
        <Alert severity="error" icon={<Warning />} sx={{ mb: 3 }}>
          <strong>Important:</strong> This will re-encrypt your vault key with the new master
          password. Your stored credential records remain intact. You will be signed out after
          the process completes.
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); }}>
            {error}
          </Alert>
        )}

        <>
            {/* Current Password */}
            <TextField
              label="Current Master Password"
              type={showCurrentPassword ? 'text' : 'password'}
              fullWidth
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); }}
              disabled={processing}
              autoFocus
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => { setShowCurrentPassword(!showCurrentPassword); }}
                      edge="end"
                    >
                      {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* New Password */}
            <TextField
              label="New Master Password"
              type={showNewPassword ? 'text' : 'password'}
              fullWidth
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); }}
              disabled={processing}
              margin="normal"
              helperText="Minimum 12 characters"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => { setShowNewPassword(!showNewPassword); }}
                      edge="end"
                    >
                      {showNewPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Password Strength Indicator */}
            {newPassword && (
              <Box sx={{ mt: 1, mb: 2 }}>
                <PasswordStrengthIndicator password={newPassword} />
              </Box>
            )}

            {/* Confirm Password */}
            <TextField
              label="Confirm New Master Password"
              type={showConfirmPassword ? 'text' : 'password'}
              fullWidth
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); }}
              disabled={processing}
              margin="normal"
              error={confirmPassword.length > 0 && newPassword !== confirmPassword}
              helperText={
                confirmPassword.length > 0 && newPassword !== confirmPassword
                  ? 'Passwords do not match'
                  : ''
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => { setShowConfirmPassword(!showConfirmPassword); }}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
        </>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={!isValid || processing}
        >
          {processing ? 'Processing...' : 'Change Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
