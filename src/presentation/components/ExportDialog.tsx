/**
 * Export Dialog Component
 * Allows users to export their vault with encryption
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
  Checkbox,
  FormControlLabel,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, Warning, Download } from '@mui/icons-material';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import { encryptExport, generateExportFilename, downloadExportFile } from '@/core/crypto/exportEncryption';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { useAuthStore } from '../store/authStore';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExportDialog({ open, onClose, onSuccess }: ExportDialogProps) {
  const { session } = useAuthStore();

  // Form state
  const [exportPassword, setExportPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Validation
  const isValid =
    exportPassword.length >= 12 &&
    exportPassword === confirmPassword &&
    confirmationChecked;

  const handleExport = async () => {
    if (!session?.vaultKey || !isValid) return;

    setError(null);
    setExporting(true);

    try {
      // Get all credentials
      const credentials = await credentialRepository.findAll(session.vaultKey);

      if (credentials.length === 0) {
        setError('No credentials to export');
        setExporting(false);
        return;
      }

      // Encrypt export
      const exportJson = await encryptExport(credentials, exportPassword);

      // Download file
      const filename = generateExportFilename();
      downloadExportFile(exportJson, filename);

      // Success
      setExporting(false);
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to export vault');
      setExporting(false);
    }
  };

  const handleClose = () => {
    if (exporting) return; // Don't allow closing during export
    setExportPassword('');
    setConfirmPassword('');
    setConfirmationChecked(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Vault</DialogTitle>

      <DialogContent>
        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Secure Vault Backup
          </Typography>
          <Typography variant="caption">
            Your vault will be encrypted with a password separate from your master password.
            Store this export password securely - you'll need it to import the vault later.
          </Typography>
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); }}>
            {error}
          </Alert>
        )}

        {/* Export Password */}
        <TextField
          label="Export Password"
          type={showPassword ? 'text' : 'password'}
          fullWidth
          value={exportPassword}
          onChange={(e) => { setExportPassword(e.target.value); }}
          disabled={exporting}
          autoFocus
          margin="normal"
          helperText="Minimum 12 characters. Different from your master password."
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => { setShowPassword(!showPassword); }} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Password Strength Indicator */}
        {exportPassword && (
          <Box sx={{ mt: 1, mb: 2 }}>
            <PasswordStrengthIndicator password={exportPassword} />
          </Box>
        )}

        {/* Confirm Password */}
        <TextField
          label="Confirm Export Password"
          type={showConfirm ? 'text' : 'password'}
          fullWidth
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); }}
          disabled={exporting}
          margin="normal"
          error={confirmPassword.length > 0 && exportPassword !== confirmPassword}
          helperText={
            confirmPassword.length > 0 && exportPassword !== confirmPassword
              ? 'Passwords do not match'
              : ''
          }
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => { setShowConfirm(!showConfirm); }} edge="end">
                  {showConfirm ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Warning Alert */}
        <Alert severity="warning" icon={<Warning />} sx={{ mt: 3, mb: 2 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Important: Save Your Export Password
          </Typography>
          <Typography variant="caption">
            Without the export password, you will not be able to import this backup. Write it
            down or store it in a secure location separate from this device.
          </Typography>
        </Alert>

        {/* Confirmation Checkbox */}
        <FormControlLabel
          control={
            <Checkbox
              checked={confirmationChecked}
              onChange={(e) => { setConfirmationChecked(e.target.checked); }}
              disabled={exporting}
            />
          }
          label={
            <Typography variant="body2">
              I have stored the export password securely and understand I cannot recover the backup
              without it
            </Typography>
          }
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={exporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          color="primary"
          disabled={!isValid || exporting}
          startIcon={exporting ? <CircularProgress size={20} /> : <Download />}
        >
          {exporting ? 'Exporting...' : 'Export Vault'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
