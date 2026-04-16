/**
 * Signin Page Component
 * Handles user authentication with master password and biometric
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { isBiometricAvailable } from '@/core/auth/webauthn';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';

export default function SigninPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const { setUser, setSession, setVaultKey } = useAuthStore();

  // Check biometric availability and redirect if no accounts exist
  useEffect(() => {
    isBiometricAvailable().then(setBiometricEnabled).catch(console.error);

    // Check if any users exist - redirect to signup if none
    userRepository.hasAnyUsers().then((hasUsers) => {
      if (!hasUsers) {
        navigate('/signup', { replace: true });
      }
    }).catch(console.error);
  }, [navigate]);

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Authenticate with user repository
      const session = await userRepository.authenticateWithPassword(email, password);

      // Get user details
      const user = await userRepository.findByEmail(email);
      if (!user) {
        throw new Error('User not found');
      }

      setUser(user);
      setSession(session);
      setVaultKey(session.vaultKey);
      console.log('Login successful');

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
      console.error('Login failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async (): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      // Get all users with biometric enabled
      const biometricUsers = await userRepository.getUsersWithBiometric();

      if (biometricUsers.length === 0) {
        setError('No biometric credentials found. Please sign in with your password first and enable biometric in Settings.');
        setIsLoading(false);
        return;
      }

      // For simplicity, use the first user with biometric (in production, show a user selector)
      const user = biometricUsers[0];
      if (!user) {
        throw new Error('No user found');
      }

      // Get the first biometric credential for this user
      const credentialId = await userRepository.getFirstBiometricCredential(user.id);
      if (!credentialId) {
        setError('No biometric credentials found for this user.');
        setIsLoading(false);
        return;
      }

      // Authenticate with biometric
      const session = await userRepository.authenticateWithBiometric(user.id, credentialId);

      // Set auth state
      setUser(user);
      setSession(session);
      setVaultKey(session.vaultKey);

      console.log('Biometric login successful');

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric authentication failed');
      console.error('Biometric login failed:', err);
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
                label="Email"
                type="email"
                value={email}
                onChange={(e): void => { setEmail(e.target.value); }}
                required
                disabled={isLoading}
                autoComplete="email"
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
                  Don't have an account?{' '}
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
