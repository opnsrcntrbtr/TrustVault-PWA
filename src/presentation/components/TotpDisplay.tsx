/**
 * TOTP Display Component
 * Shows live TOTP code with countdown timer
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Paper,
} from '@mui/material';
import { ContentCopy, Check } from '@mui/icons-material';
import {
  generateTOTP,
  formatTOTPCode,
  getTOTPRemaining,
  isValidTOTPSecret,
} from '@/core/auth/totp';

interface TotpDisplayProps {
  totpSecret: string;
  timeStep?: number;
}

export default function TotpDisplay({ totpSecret, timeStep = 30 }: TotpDisplayProps) {
  const [code, setCode] = useState<string>('');
  const [remaining, setRemaining] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate TOTP secret on mount
  useEffect(() => {
    if (!isValidTOTPSecret(totpSecret)) {
      setError('Invalid TOTP secret format');
      return;
    }

    setError(null);
  }, [totpSecret]);

  // Update TOTP code and countdown every second
  useEffect(() => {
    if (error) return;

    const updateTOTP = () => {
      try {
        const now = Date.now();
        const newCode = generateTOTP(totpSecret, timeStep, 6, now);
        const newRemaining = getTOTPRemaining(timeStep, now);

        setCode(newCode);
        setRemaining(newRemaining);
      } catch (err) {
        console.error('Failed to generate TOTP:', err);
        setError('Failed to generate code');
      }
    };

    // Initial generation
    updateTOTP();

    // Update every second
    const interval = setInterval(updateTOTP, 1000);

    return () => { clearInterval(interval); };
  }, [totpSecret, timeStep, error]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy TOTP code:', err);
    }
  };

  // Calculate progress percentage (0-100)
  const progress = (remaining / timeStep) * 100;

  // Color based on remaining time
  const getColor = () => {
    if (remaining <= 5) return 'error'; // Red when < 5 seconds
    if (remaining <= 10) return 'warning'; // Orange when < 10 seconds
    return 'primary'; // Blue otherwise
  };

  if (error) {
    return (
      <Paper
        sx={{
          p: 2,
          backgroundColor: 'error.dark',
          color: 'error.contrastText',
        }}
      >
        <Typography variant="body2">{error}</Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {/* TOTP Code */}
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          2FA Code
        </Typography>
        <Typography
          variant="h4"
          component="div"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 600,
            letterSpacing: 2,
            color: getColor() + '.main',
          }}
        >
          {formatTOTPCode(code)}
        </Typography>
      </Box>

      {/* Countdown Timer */}
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={progress}
          size={48}
          thickness={4}
          color={getColor()}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="caption"
            component="div"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            {remaining}s
          </Typography>
        </Box>
      </Box>

      {/* Copy Button */}
      <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
        <IconButton
          onClick={handleCopy}
          color={copied ? 'success' : 'default'}
          sx={{ ml: 1 }}
        >
          {copied ? <Check /> : <ContentCopy />}
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
