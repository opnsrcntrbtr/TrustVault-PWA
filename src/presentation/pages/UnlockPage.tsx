/**
 * UnlockPage Component
 * Full-page unlock screen shown when vault is locked
 * Provides secure re-authentication with master password
 */

import { useState } from 'react';
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
} from '@mui/material';
import { Lock, Visibility, VisibilityOff, LockOpen } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { unlockWithPassword } from '@/application/services/authService';

export default function UnlockPage() {
  const navigate = useNavigate();
  const { user, unlockVault, setSession, setUser, signout } = useAuthStore();
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
      const result = await unlockWithPassword(user.email, password);

      // Unlock vault with the vault key
      setUser(result.user);
      setSession(result.session);
      unlockVault(result.session.vaultKey);

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
              <strong>Account:</strong> {user.email}
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
