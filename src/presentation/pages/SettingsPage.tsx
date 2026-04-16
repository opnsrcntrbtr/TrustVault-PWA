/**
 * Settings Page
 * Comprehensive settings for user preferences and security
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Divider,
  Button,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
} from '@mui/material';
import { ArrowBack, SystemUpdate, CheckCircle, Refresh } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { useCredentialStore } from '../store/credentialStore';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';
import AutoLockSettings from '../components/AutoLockSettings';
import ClipboardSettings from '../components/ClipboardSettings';
import ChangeMasterPasswordDialog from '../components/ChangeMasterPasswordDialog';
import ExportDialog from '../components/ExportDialog';
import ImportDialog from '../components/ImportDialog';
import BiometricSetupDialog from '../components/BiometricSetupDialog';
import ThemeToggle from '../components/ThemeToggle';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const { clearCredentials } = useCredentialStore();

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [biometricDialogOpen, setBiometricDialogOpen] = useState(false);

  // Security settings state
  const [sessionTimeout, setSessionTimeout] = useState(
    user?.securitySettings?.sessionTimeoutMinutes ?? 15
  );
  const [clipboardClearSeconds, setClipboardClearSeconds] = useState(
    user?.securitySettings?.clipboardClearSeconds ?? 30
  );

  // Service Worker update management
  const {
    updateAvailable,
    updateChecking,
    currentVersion,
    availableVersion,
    checkForUpdate,
    error: updateError,
  } = useServiceWorkerUpdate();

  // Save settings to database
  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      // Update security settings
      await userRepository.updateSecuritySettings(user.id, {
        sessionTimeoutMinutes: sessionTimeout,
        clipboardClearSeconds: clipboardClearSeconds,
      });

      // Update user in store
      const updatedUser = {
        ...user,
        securitySettings: {
          ...user.securitySettings,
          sessionTimeoutMinutes: sessionTimeout,
          clipboardClearSeconds: clipboardClearSeconds,
        },
      };

      setUser(updatedUser);

      setSaveMessage('Settings saved successfully');
      setTimeout(() => { setSaveMessage(null); }, 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save when settings change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) {
        saveSettings();
      }
    }, 500); // Debounce 500ms

    return () => { clearTimeout(timer); };
  }, [sessionTimeout, clipboardClearSeconds]);

  const handleClearAllData = async () => {
    const firstConfirm = window.confirm(
      'Are you sure you want to clear all data? This action cannot be undone.'
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      'This will permanently delete ALL your credentials and account data. Are you absolutely sure?'
    );

    if (!secondConfirm) return;

    try {
      // Clear all data
      const { clearAllData } = await import('@/data/storage/debugUtils');
      await clearAllData();

      // Clear stores
      clearCredentials();
      useAuthStore.getState().signout();

      // Navigate to signup
      navigate('/signup', { replace: true });
    } catch (err) {
      console.error('Failed to clear data:', err);
      setError('Failed to clear data. Please try again.');
    }
  };

  if (!user) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 4 }}>
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            Settings
          </Typography>
          {saving && <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />}
          <ThemeToggle />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4 }}>
        {/* Save message */}
        {saveMessage && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {saveMessage}
          </Alert>
        )}

        {/* Error message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => { setError(null); }}>
            {error}
          </Alert>
        )}

        {/* Security Settings */}
        <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
          Security Settings
        </Typography>

        <AutoLockSettings
          sessionTimeoutMinutes={sessionTimeout}
          lockOnTabHidden={false}
          onSave={(settings: { sessionTimeoutMinutes: number; lockOnTabHidden: boolean }) => {
            setSessionTimeout(settings.sessionTimeoutMinutes);
          }}
        />

        <ClipboardSettings
          clipboardClearSeconds={clipboardClearSeconds}
          onSave={(seconds) => { setClipboardClearSeconds(seconds); }}
        />

        {/* Biometric Authentication */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Biometric Authentication
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Use your fingerprint, face, or security key (YubiKey, Titan) to unlock TrustVault faster.
            Your master password is still required for initial setup and critical operations.
          </Typography>
          
          {user.biometricEnabled && user.webAuthnCredentials.length > 0 ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                ✓ Biometric authentication is enabled ({user.webAuthnCredentials.length} {user.webAuthnCredentials.length === 1 ? 'device' : 'devices'} registered)
              </Typography>
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              No biometric credentials registered yet
            </Alert>
          )}
          
          <Button
            variant="outlined"
            color="primary"
            onClick={() => { setBiometricDialogOpen(true); }}
          >
            Manage Biometric Devices
          </Button>
        </Paper>

        <Divider sx={{ my: 4 }} />

        {/* Display Settings */}
        <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
          Display Settings
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Theme
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose your preferred color theme. (Currently Dark theme only)
          </Typography>
          <Alert severity="info">
            Light theme and system theme will be available in a future update.
          </Alert>
        </Paper>

        {/* App Updates */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SystemUpdate />
            App Updates
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Check for and install updates to TrustVault PWA. Updates include new features,
            security improvements, and bug fixes.
          </Typography>

          {updateError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
              {updateError}
            </Alert>
          )}

          {updateAvailable && (
            <Alert
              severity="success"
              icon={<CheckCircle />}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2" fontWeight={600}>
                Update Available
              </Typography>
              <Typography variant="caption">
                {currentVersion && `Current: ${currentVersion}`}
                {availableVersion && ` → New: ${availableVersion}`}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Click the notification at the bottom of the screen to install.
              </Typography>
            </Alert>
          )}

          {!updateAvailable && !updateError && !updateChecking && currentVersion && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                You're running the latest version ({currentVersion})
              </Typography>
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="outlined"
              startIcon={updateChecking ? <CircularProgress size={16} /> : <Refresh />}
              onClick={() => void checkForUpdate()}
              disabled={updateChecking}
            >
              {updateChecking ? 'Checking...' : 'Check for Updates'}
            </Button>

            {currentVersion && !updateChecking && (
              <Typography variant="caption" color="text.secondary">
                Current: {currentVersion}
              </Typography>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            💡 Updates are automatically checked in the background. You'll see a notification
            when a new version is available.
          </Typography>
        </Paper>

        <Divider sx={{ my: 4 }} />

        {/* Password Generator Defaults */}
        <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
          Password Generator Defaults
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These settings are stored locally and will be remembered when you use the password
            generator.
          </Typography>
          <Alert severity="info">
            Password generator preferences are automatically saved when you use the generator.
          </Alert>
        </Paper>

        <Divider sx={{ my: 4 }} />

        {/* Data Management */}
        <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
          Data Management
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Export & Import
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Backup your vault with encryption or import credentials from another device.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => { setExportDialogOpen(true); }}
            >
              Export Vault
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => { setImportDialogOpen(true); }}
            >
              Import Vault
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Clear All Data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Permanently delete all credentials and account data from this device. This action cannot
            be undone.
          </Typography>

          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Warning: This will delete everything
            </Typography>
            <Typography variant="caption">
              All your credentials, settings, and account information will be permanently removed.
              You will need to create a new account to use TrustVault again.
            </Typography>
          </Alert>

          <Button variant="contained" color="error" onClick={handleClearAllData}>
            Clear All Data
          </Button>
        </Paper>

        <Divider sx={{ my: 4 }} />

        {/* Account Information */}
        <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
          Account
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Master Password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Change your master password. This will re-encrypt all credentials with the new password.
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => { setChangePasswordDialogOpen(true); }}
          >
            Change Master Password
          </Button>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Account Information
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body1">{user.email}</Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Account Created
              </Typography>
              <Typography variant="body1">
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Last Login
              </Typography>
              <Typography variant="body1">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Never'}
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>

      {/* Change Master Password Dialog */}
      <ChangeMasterPasswordDialog
        open={changePasswordDialogOpen}
        onClose={() => { setChangePasswordDialogOpen(false); }}
        onSuccess={() => {
          setSaveMessage('Master password changed successfully!');
          setChangePasswordDialogOpen(false);
        }}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => { setExportDialogOpen(false); }}
        onSuccess={() => {
          setSaveMessage('Vault exported successfully!');
          setExportDialogOpen(false);
        }}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onClose={() => { setImportDialogOpen(false); }}
        onSuccess={(count) => {
          setSaveMessage(`Successfully imported ${count} credentials!`);
          setImportDialogOpen(false);
        }}
      />

      {/* Biometric Setup Dialog */}
      <BiometricSetupDialog
        open={biometricDialogOpen}
        onClose={() => { setBiometricDialogOpen(false); }}
      />
    </Box>
  );
}
