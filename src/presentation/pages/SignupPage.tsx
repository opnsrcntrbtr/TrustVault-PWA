/**
 * Signup Page Component
 * Handles new account creation with master password
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

export default function SignupPage() {
  const navigate = useNavigate();
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
      setSuccess('Account created successfully! Redirecting to dashboard...');

      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      console.error('Signup failed:', err);
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
