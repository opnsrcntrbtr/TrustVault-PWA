/**
 * Signin Page Component
 * Handles user authentication with username + master password, or biometric.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  Alert,
  Stack,
  Divider,
  Link,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Fingerprint,
  Lock,
  Shield,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';

export default function SigninPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const { setUser, setSession, setVaultKey } = useAuthStore();
  const shouldAutoRedirectToSignup =
    Boolean((location.state as { autoRedirectToSignup?: boolean } | null)?.autoRedirectToSignup);

  // Drive biometric button visibility from DB state, not platform hardware check.
  useEffect(() => {
    let mounted = true;

    userRepository.getUsersWithBiometric()
      .then(users => { if (mounted) setBiometricEnabled(users.length > 0); })
      .catch(console.error);

    userRepository.hasAnyUsers().then((hasUsers) => {
      if (mounted && shouldAutoRedirectToSignup && !hasUsers) {
        navigate('/signup', { replace: true });
      }
    }).catch(console.error);

    return () => { mounted = false; };
  }, [navigate, shouldAutoRedirectToSignup]);

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const session = await userRepository.authenticateWithPassword(username, password);

      const user = await userRepository.findById(session.userId);
      if (!user) {
        throw new Error('User not found');
      }

      setUser(user);
      setSession(session);
      setVaultKey(session.vaultKey);

      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async (): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      const biometricUsers = await userRepository.getUsersWithBiometric();

      if (biometricUsers.length === 0) {
        setError('No biometric credentials found. Please sign in with your password first and enable biometric in Settings.');
        setIsLoading(false);
        return;
      }

      const user = biometricUsers[0];
      if (!user) {
        throw new Error('No user found');
      }

      const credentialId = await userRepository.getFirstBiometricCredential(user.id);
      if (!credentialId) {
        setError('No biometric credentials found for this user.');
        setIsLoading(false);
        return;
      }

      const session = await userRepository.authenticateWithBiometric(user.id, credentialId);

      setUser(user);
      setSession(session);
      setVaultKey(session.vaultKey);

      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
        padding: 3,
      }}
    >
      <Card sx={{ maxWidth: 450, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Shield sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to access your secure vault
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={(e): void => { void handleSignin(e); }}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Username"
                type="text"
                value={username}
                onChange={(e): void => { setUsername(e.target.value); }}
                required
                disabled={isLoading}
                autoComplete="username"
                inputProps={{ maxLength: 32 }}
              />

              <TextField
                fullWidth
                label="Master Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e): void => { setPassword(e.target.value); }}
                required
                disabled={isLoading}
                autoComplete="current-password"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={(): void => { setShowPassword(!showPassword); }}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={isLoading}
                startIcon={<Lock />}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              {biometricEnabled && (
                <>
                  <Divider>
                    <Typography variant="body2" color="text.secondary">
                      OR
                    </Typography>
                  </Divider>

                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={handleBiometricLogin}
                    disabled={isLoading}
                    startIcon={<Fingerprint />}
                  >
                    Use Biometric
                  </Button>
                </>
              )}

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Don&apos;t have an account?{' '}
                  <Link
                    onClick={(): void => { navigate('/signup'); }}
                    sx={{ cursor: 'pointer' }}
                  >
                    Create one
                  </Link>
                </Typography>
              </Box>
            </Stack>
          </form>

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              🔒 End-to-end encrypted • Zero-knowledge architecture
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
