/**
 * Clipboard Notification Component
 * Shows countdown notification when sensitive data is copied to clipboard
 */

import { useState, useEffect } from 'react';
import { Snackbar, Alert, AlertTitle, LinearProgress, Box, Typography, IconButton } from '@mui/material';
import { ContentCopy, Close, Timer } from '@mui/icons-material';
import { clipboardManager, formatRemainingTime } from '../utils/clipboard';

interface ClipboardNotificationProps {
  /** Optional custom timeout in seconds */
  defaultTimeout?: number;
}

export default function ClipboardNotification({ defaultTimeout = 30 }: ClipboardNotificationProps) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Setup countdown callback
    clipboardManager.onCountdown((seconds) => {
      setRemaining(seconds);

      if (seconds > 0 && !open) {
        setOpen(true);
      }
    });

    // Setup clear callback
    clipboardManager.onClear(() => {
      setMessage('Clipboard cleared');
      setTimeout(() => {
        setOpen(false);
        setRemaining(0);
      }, 2000);
    });

    // Cleanup
    return () => {
      clipboardManager.onCountdown(() => {});
      clipboardManager.onClear(() => {});
    };
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    clipboardManager.cancelTimers();
  };

  const progress = remaining > 0 ? (remaining / defaultTimeout) * 100 : 0;

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ mb: 2 }}
    >
      <Alert
        severity={remaining > 0 ? 'info' : 'success'}
        icon={remaining > 0 ? <Timer /> : <ContentCopy />}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={handleClose}
          >
            <Close fontSize="small" />
          </IconButton>
        }
        sx={{
          width: '100%',
          minWidth: 300,
          alignItems: 'center',
        }}
      >
        {remaining > 0 ? (
          <Box sx={{ width: '100%' }}>
            <AlertTitle sx={{ mb: 1 }}>
              Copied to clipboard
            </AlertTitle>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Clipboard will auto-clear in <strong>{formatRemainingTime(remaining)}</strong>
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 6,
                borderRadius: 1,
                backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: remaining <= 5 ? 'error.main' : 'info.main',
                },
              }}
            />
          </Box>
        ) : (
          <Typography variant="body2">
            {message || 'Clipboard cleared for security'}
          </Typography>
        )}
      </Alert>
    </Snackbar>
  );
}
