/**
 * Biometric Setup Dialog
 * Allows users to register and manage WebAuthn biometric credentials
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import {
  Fingerprint,
  Delete,
  Add,
  Security,
  CheckCircle,
  Phone,
  Computer,
  Key,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';
import { getDeviceName, isBiometricAvailable, getAuthenticatorInfo } from '@/core/auth/webauthn';
import type { WebAuthnCredential } from '@/domain/entities/User';

interface BiometricSetupDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function BiometricSetupDialog({ open, onClose }: BiometricSetupDialogProps) {
  const { user, vaultKey } = useAuthStore();
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [authenticatorInfo, setAuthenticatorInfo] = useState<{
    biometricAvailable: boolean;
    conditionalMediationAvailable: boolean;
  } | null>(null);

  useEffect(() => {
    if (open && user) {
      loadCredentials();
      checkBiometricAvailability();
    }
  }, [open, user]);

  const loadCredentials = async () => {
    if (!user) return;

    try {
      const fullUser = await userRepository.findById(user.id);
      if (fullUser) {
        setCredentials(fullUser.webAuthnCredentials);
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
    }
  };

  const checkBiometricAvailability = async () => {
    try {
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);

      const info = await getAuthenticatorInfo();
      setAuthenticatorInfo(info);
    } catch (err) {
      console.error('Failed to check biometric availability:', err);
      setBiometricAvailable(false);
    }
  };

  const handleRegisterBiometric = async () => {
    if (!user || !vaultKey) {
      setError('You must be logged in with your master password to register biometric');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const deviceName = getDeviceName();
      await userRepository.registerBiometric(user.id, vaultKey, deviceName);

      setSuccess(`${deviceName} registered successfully!`);
      await loadCredentials();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register biometric';
      setError(errorMessage);
      console.error('Biometric registration failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCredential = async (credentialId: string) => {
    if (!user) return;

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await userRepository.removeBiometric(user.id, credentialId);
      setSuccess('Biometric credential removed');
      await loadCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove credential');
      console.error('Failed to remove credential:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceIcon = (deviceName?: string) => {
    if (!deviceName) return <Fingerprint />;
    
    if (deviceName.includes('iPhone') || deviceName.includes('iPad') || deviceName.includes('Android')) {
      return <Phone />;
    }
    if (deviceName.includes('Mac') || deviceName.includes('Windows')) {
      return <Computer />;
    }
    if (deviceName.includes('YubiKey') || deviceName.includes('Key')) {
      return <Key />;
    }
    
    return <Fingerprint />;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      disablePortal={false}
      keepMounted={false}
      aria-labelledby="biometric-dialog-title"
    >
      <DialogTitle id="biometric-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security color="primary" />
          <Typography variant="h6">Biometric Authentication</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => { setSuccess(null); }}>
            {success}
          </Alert>
        )}

        {!biometricAvailable && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Biometric authentication is not available on this device or browser.
          </Alert>
        )}

        {biometricAvailable && !vaultKey && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Please unlock your vault with your master password before registering biometric authentication.
          </Alert>
        )}

        {authenticatorInfo && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Device Capabilities:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {authenticatorInfo.biometricAvailable && (
                <Chip
                  icon={<CheckCircle />}
                  label="Platform Authenticator"
                  size="small"
                  color="success"
                />
              )}
              {authenticatorInfo.conditionalMediationAvailable && (
                <Chip
                  icon={<CheckCircle />}
                  label="Autofill UI"
                  size="small"
                  color="success"
                />
              )}
            </Stack>
          </Box>
        )}

        {window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              HTTPS Required
            </Typography>
            <Typography variant="caption">
              Biometric authentication requires a secure connection. Please use <code>npm run dev:https</code> or access via <code>https://localhost:3000</code>
            </Typography>
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" paragraph>
          Register your fingerprint, face, or security key to unlock TrustVault faster.
          You can register multiple devices.
        </Typography>

        {credentials.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Registered Devices ({credentials.length})
            </Typography>
            <List>
              {credentials.map((credential) => (
                <ListItem
                  key={credential.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <Box sx={{ mr: 2 }}>{getDeviceIcon(credential.deviceName)}</Box>
                  <ListItemText
                    primary={credential.deviceName || 'Biometric Device'}
                    secondary={
                      <>
                        <Typography variant="caption" display="block">
                          Registered: {formatDate(credential.createdAt)}
                        </Typography>
                        {credential.lastUsedAt && (
                          <Typography variant="caption" display="block">
                            Last used: {formatDate(credential.lastUsedAt)}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          ID: {credential.id.substring(0, 16)}...
                        </Typography>
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveCredential(credential.id)}
                      disabled={isLoading}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {credentials.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              borderStyle: 'dashed',
            }}
          >
            <Fingerprint sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No biometric credentials registered yet
            </Typography>
          </Box>
        )}

        <Button
          fullWidth
          variant={credentials.length === 0 ? 'contained' : 'outlined'}
          startIcon={isLoading ? <CircularProgress size={20} /> : <Add />}
          onClick={handleRegisterBiometric}
          disabled={!biometricAvailable || !vaultKey || isLoading}
          sx={{ mt: 2 }}
        >
          {isLoading ? 'Registering...' : 'Register New Device'}
        </Button>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            🔒 <strong>Security Note:</strong> Biometric authentication provides quick access
            while maintaining security. Your master password is still required for initial setup
            and critical operations.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
