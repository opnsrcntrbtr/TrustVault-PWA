/**
 * UnlockPage Component
 * Full-page unlock screen shown when vault is locked
 * Provides secure re-authentication with master password
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Avatar,
  Divider,
} from '@mui/material';
import { Lock, Visibility, VisibilityOff, LockOpen, Fingerprint } from '@mui/icons-material';
import { useAuthStore, isFullUser } from '../store/authStore';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';

export default function UnlockPage() {
  const navigate = useNavigate();
  const { user, unlockVault, signout, setUser } = useAuthStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [biometricCredentialId, setBiometricCredentialId] = useState<string | null>(null);

  // Drive biometric button visibility from this user's stored credentials.
  useEffect(() => {
    let mounted = true;

    if (!user) {
      return;
    }

    userRepository.getFirstBiometricCredential(user.id)
      .then(credentialId => { if (mounted) setBiometricCredentialId(credentialId); })
      .catch(console.error);

    return () => { mounted = false; };
  }, [user]);

  // Rehydrated `user` may still be the persisted shell (no
  // hashedMasterPassword/securitySettings) if App's boot refetch lost the
  // race against the 2s init timeout. Promote it to the full User from
  // IndexedDB before completing unlock so authenticated flows never see
  // a partial User.
  const promoteShellUser = async (userId: string): Promise<void> => {
    if (isFullUser(useAuthStore.getState().user)) {
      return;
    }
    const fullUser = await userRepository.findById(userId);
    if (fullUser) {
      setUser(fullUser);
    }
  };

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
      const session = await userRepository.authenticateWithPassword(user.username ?? user.id, password);

      // Ensure the store holds the full User (not the rehydrated shell)
      // before any authenticated screen can read security-bearing fields.
      await promoteShellUser(session.userId);

      // Unlock vault with the vault key
      unlockVault(session.vaultKey);

      // Clear password from memory
      setPassword('');

      // Navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Unlock failed:', err);
      setError('Incorrect password. Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!user) {
      setError('User session not found. Please sign in again.');
      return;
    }

    if (!biometricCredentialId) {
      setError('No biometric credentials found for this account.');
      return;
    }

    setUnlocking(true);
    setError(null);

    try {
      // Authenticate with biometric to recover the vault key
      const session = await userRepository.authenticateWithBiometric(user.id, biometricCredentialId);

      // Ensure the store holds the full User (not the rehydrated shell)
      // before any authenticated screen can read security-bearing fields.
      await promoteShellUser(session.userId);

      // Unlock vault with the vault key
      unlockVault(session.vaultKey);

      // Navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Biometric unlock failed:', err);
      setError(err instanceof Error ? err.message : 'Biometric authentication failed');
    } finally {
      setUnlocking(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !unlocking) {
      handleUnlock();
    }
  };

  const handleSignOut = () => {
    signout();
    navigate('/signin', { replace: true });
  };

  if (!user) {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        px: 2,
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {/* Lock Icon */}
          <Avatar
            sx={{
              width: 80,
              height: 80,
              bgcolor: 'primary.main',
              mb: 1,
            }}
          >
            <Lock sx={{ fontSize: 48 }} />
          </Avatar>

          {/* Title */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Vault Locked
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Enter your master password to unlock
            </Typography>
          </Box>

          {/* User Info */}
          <Alert severity="info" sx={{ width: '100%' }}>
            <Typography variant="body2">
              <strong>Account:</strong> {user.username ?? user.email}
            </Typography>
          </Alert>

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ width: '100%' }}>
              {error}
            </Alert>
          )}

          {/* Password Field */}
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

          {/* Security Note */}
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Your vault was locked for security. Your master password is never stored and is used
            only to decrypt your credentials.
          </Typography>

          {/* Unlock Button */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleUnlock}
            disabled={!password || unlocking}
            startIcon={unlocking ? <CircularProgress size={20} /> : <LockOpen />}
          >
            {unlocking ? 'Unlocking...' : 'Unlock Vault'}
          </Button>

          {/* Biometric Unlock */}
          {biometricCredentialId && (
            <>
              <Divider sx={{ width: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  OR
                </Typography>
              </Divider>

              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={handleBiometricUnlock}
                disabled={unlocking}
                startIcon={<Fingerprint />}
              >
                Use Biometric
              </Button>
            </>
          )}

          {/* Sign Out Button */}
          <Button
            fullWidth
            variant="outlined"
            size="medium"
            onClick={handleSignOut}
            disabled={unlocking}
          >
            Sign Out
          </Button>

          {/* Auto-Lock Info */}
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            💡 Tip: You can configure auto-lock timeout in Settings after unlocking
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
