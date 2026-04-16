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
import ReEncryptionProgress from './ReEncryptionProgress';
import { verifyPassword } from '@/core/crypto/password';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
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
  const [reEncrypting, setReEncrypting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

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
      // Step 1: Verify current password
      const isCurrentPasswordValid = await verifyPassword(
        currentPassword,
        user.hashedMasterPassword
      );

      if (!isCurrentPasswordValid) {
        setError('Current password is incorrect');
        setProcessing(false);
        return;
      }

      // Step 2: Get current vault key from store
      const vaultKey = useAuthStore.getState().vaultKey;
      if (!vaultKey) {
        setError('Session expired. Please sign in again.');
        setProcessing(false);
        return;
      }

      const oldVaultKey = vaultKey;

      // Step 3: Start re-encryption process
      setReEncrypting(true);

      // Step 4: Get all credentials
      const allCredentials = await credentialRepository.findAll(oldVaultKey);
      setProgress({ current: 0, total: allCredentials.length });

      // Step 5: Change master password (this derives new vault key)
      await userRepository.changeMasterPassword(
        user.id,
        currentPassword,
        newPassword
      );

      // Step 6: Re-authenticate to get new vault key
      const authResult = await userRepository.authenticateWithPassword(
        user.email,
        newPassword
      );

      if (!authResult.vaultKey) {
        throw new Error('Failed to get new vault key');
      }

      const newVaultKey = authResult.vaultKey;

      // Step 7: Re-encrypt all credentials
      for (let i = 0; i < allCredentials.length; i++) {
        const credential = allCredentials[i]!;

        // Delete old encrypted version
        await credentialRepository.delete(credential.id);

        // Save with new key (will encrypt with new vault key)
        await credentialRepository.create(credential, newVaultKey);

        // Update progress
        setProgress({ current: i + 1, total: allCredentials.length });
      }

      // Step 8: Success - sign out to force re-login with new password
      setReEncrypting(false);
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
      setReEncrypting(false);
    }
  };

  const handleClose = () => {
    if (processing) return; // Don't allow closing during processing
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setReEncrypting(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Change Master Password</DialogTitle>

      <DialogContent>
        {/* Warning Alert */}
        <Alert severity="error" icon={<Warning />} sx={{ mb: 3 }}>
          <strong>Important:</strong> This will re-encrypt all your credentials. You will be
          signed out after the process completes. Make sure you remember your new password.
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); }}>
            {error}
          </Alert>
        )}

        {/* Re-encryption Progress */}
        {reEncrypting ? (
          <ReEncryptionProgress current={progress.current} total={progress.total} />
        ) : (
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
        )}
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
