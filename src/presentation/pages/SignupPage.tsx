/**
 * Signup Page Component
 * Handles new account creation with username (required) and master password.
 * Email is optional — a local-only recovery hint, never shared.
 */

import { useState } from 'react';
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
  Link,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonAdd,
  Shield,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';
import { validateUsername } from '@/core/auth/usernameValidation';

export default function SignupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { setUser, setSession, setVaultKey } = useAuthStore();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const usernameResult = validateUsername(username);
    if (!usernameResult.valid) {
      setUsernameError(usernameResult.error ?? 'Invalid username');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const user = await userRepository.createUser(
        username,
        password,
        email.trim() !== '' ? email.trim() : undefined,
      );

      const session = await userRepository.authenticateWithPassword(username, password);

      setUser(user);
      setSession(session);
      setVaultKey(session.vaultKey);
      setSuccess('Account created successfully! Redirecting to dashboard...');

      // No explicit navigate here: the route guard in App.tsx redirects to
      // /dashboard as soon as isAuthenticated becomes true above. A delayed
      // setTimeout-based navigate would fire later regardless of where the
      // user has since navigated.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
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
              Create Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Set up your secure TrustVault account
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

          <form onSubmit={(e): void => { void handleSignup(e); }}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Username"
                type="text"
                value={username}
                onChange={(e): void => {
                  setUsername(e.target.value);
                  if (usernameError) setUsernameError(null);
                }}
                onBlur={(): void => {
                  if (username.length > 0) {
                    const result = validateUsername(username);
                    if (!result.valid) setUsernameError(result.error ?? null);
                  }
                }}
                required
                disabled={isLoading}
                autoComplete="username"
                error={usernameError !== null}
                helperText={usernameError ?? 'Letters, numbers, dot, underscore, or hyphen (3–32 chars)'}
                inputProps={{ maxLength: 32 }}
              />

              <TextField
                fullWidth
                label="Email (optional)"
                type="email"
                value={email}
                onChange={(e): void => { setEmail(e.target.value); }}
                disabled={isLoading}
                autoComplete="email"
                helperText="Optional — stored locally only as a recovery hint, never shared"
              />

              <TextField
                fullWidth
                label="Master Password (min 12 characters)"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e): void => { setPassword(e.target.value); }}
                required
                disabled={isLoading}
                autoComplete="new-password"
                helperText="Choose a strong master password. You cannot recover it if lost!"
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

              <TextField
                fullWidth
                label="Confirm Master Password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e): void => { setConfirmPassword(e.target.value); }}
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

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={isLoading}
                startIcon={<PersonAdd />}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Already have an account?{' '}
                  <Link
                    onClick={(): void => { navigate('/signin'); }}
                    sx={{ cursor: 'pointer' }}
                  >
                    Sign in
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
