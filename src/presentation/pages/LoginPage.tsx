/**
 * Login Page Component
 * Handles master password and biometric authentication
 */

import { useState, useEffect } from 'react';
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
  PersonAdd,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { isBiometricAvailable } from '@/core/auth/webauthn';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasExistingAccount, setHasExistingAccount] = useState<boolean | null>(null);

  const { setUser, setSession, setVaultKey } = useAuthStore();

  // Check biometric availability and existing accounts on mount
  useEffect(() => {
    isBiometricAvailable().then(setBiometricEnabled).catch(console.error);

    // Check if any users exist
    userRepository.hasAnyUsers().then((hasUsers) => {
      setHasExistingAccount(hasUsers);
      // Default to signup if no users exist
      if (!hasUsers) {
        setMode('signup');
      }
    }).catch(console.error);
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // Validate passwords match
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Validate password strength (minimum requirements)
      if (password.length < 12) {
        throw new Error('Password must be at least 12 characters long');
      }

      // Create new user
      const user = await userRepository.createUser(email, password);
      console.log('User created successfully');

      // Automatically authenticate after signup
      const session = await userRepository.authenticateWithPassword(email, password);

      setUser(user);
      setSession(session);
      setVaultKey(session.vaultKey);
      setSuccess('Account created successfully! Welcome to TrustVault.');

      // Update account existence state
      setHasExistingAccount(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      console.error('Signup failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
      console.error('Login failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async (): Promise<void> => {
    if (!email) {
      setError('Please enter your email to identify your account');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // Find user by email
      const targetUser = await userRepository.findByEmail(email);
      if (!targetUser) {
        throw new Error('User not found. Please sign in with your password first.');
      }

      // Check if biometric is enabled
      if (!targetUser.biometricEnabled || targetUser.webAuthnCredentials.length === 0) {
        throw new Error('Biometric authentication is not set up for this account. Please sign in with your password first.');
      }

      // Get the first biometric credential ID for authentication
      const credentialId = targetUser.webAuthnCredentials[0]?.id;
      if (!credentialId) {
        throw new Error('No biometric credential found. Please sign in with your password and re-enable biometric in Settings.');
      }

      // Perform full biometric authentication (WebAuthn + vault key decryption)
      const session = await userRepository.authenticateWithBiometric(targetUser.id, credentialId);

      // Set authentication state with vault key
      setUser(targetUser);
      setSession(session);
      setVaultKey(session.vaultKey);
      console.log('Biometric login successful');
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
              TrustVault
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mode === 'signup'
                ? 'Create your secure vault account'
                : 'Enterprise-grade security for your credentials'}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={(e): void => {
            void (mode === 'signup' ? handleSignup(e) : handleLogin(e));
          }}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e): void => {
                  setEmail(e.target.value);
                }}
                required
                disabled={isLoading}
                autoComplete="email"
              />

              <TextField
                fullWidth
                label={mode === 'signup' ? 'Master Password (min 12 characters)' : 'Master Password'}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e): void => {
                  setPassword(e.target.value);
                }}
                required
                disabled={isLoading}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                helperText={mode === 'signup' ? 'Choose a strong master password. You cannot recover it if lost!' : ''}
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

              {mode === 'signup' && (
                <TextField
                  fullWidth
                  label="Confirm Master Password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e): void => {
                    setConfirmPassword(e.target.value);
                  }}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  error={confirmPassword.length > 0 && password !== confirmPassword}
                  helperText={
                    confirmPassword.length > 0 && password !== confirmPassword
                      ? 'Passwords do not match'
                      : ''
                  }
                />
              )}

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={isLoading}
                startIcon={mode === 'signup' ? <PersonAdd /> : <Lock />}
              >
                {isLoading
                  ? (mode === 'signup' ? 'Creating Account...' : 'Unlocking...')
                  : (mode === 'signup' ? 'Create Account' : 'Unlock Vault')}
              </Button>

              {mode === 'login' && biometricEnabled && (
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

              {/* Toggle between login and signup */}
              {hasExistingAccount !== null && (
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <Link
                      component="button"
                      type="button"
                      onClick={(): void => {
                        setMode(mode === 'login' ? 'signup' : 'login');
                        setError(null);
                        setSuccess(null);
                        setPassword('');
                        setConfirmPassword('');
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      {mode === 'login' ? 'Create one' : 'Sign in'}
                    </Link>
                  </Typography>
                </Box>
              )}
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
