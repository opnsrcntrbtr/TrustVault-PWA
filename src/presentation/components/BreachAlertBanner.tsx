/**
 * Breach Alert Banner Component
 * Displays prominent alert when breached credentials are detected
 */

import { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  IconButton,
  Box,
  Collapse,
  Typography,
} from '@mui/material';
import {
  Warning,
  Close,
  Visibility,
  Security,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getAllBreachedCredentials } from '@/data/repositories/breachResultsRepository';

const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const STORAGE_KEY = 'breach-alert-dismissed';

interface BreachAlertBannerProps {
  /** Force refresh of breach data */
  refreshTrigger?: number;
}

export default function BreachAlertBanner({ refreshTrigger }: BreachAlertBannerProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [breachCount, setBreachCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    checkForBreaches();
  }, [refreshTrigger]);

  const checkForBreaches = async () => {
    try {
      const breached = await getAllBreachedCredentials();
      const count = breached.length;

      if (count === 0) {
        setOpen(false);
        return;
      }

      // Count critical/high severity breaches
      const critical = breached.filter(
        b => b.severity === 'critical' || b.severity === 'high'
      ).length;

      setBreachCount(count);
      setCriticalCount(critical);

      // Check if dismissed recently
      const dismissedStr = localStorage.getItem(STORAGE_KEY);
      if (dismissedStr) {
        const dismissed = parseInt(dismissedStr, 10);
        if (Date.now() - dismissed < DISMISS_DURATION) {
          setOpen(false);
          return;
        }
      }

      setOpen(true);
    } catch (error) {
      console.error('Failed to check breaches:', error);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setOpen(false);
  };

  const handleReview = () => {
    navigate('/security');
  };

  if (!open || breachCount === 0) {
    return null;
  }

  const severity = criticalCount > 0 ? 'error' : 'warning';

  return (
    <Collapse in={open}>
      <Alert
        severity={severity}
        icon={<Warning />}
        sx={{
          mb: 2,
          borderRadius: 2,
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={handleDismiss}
          >
            <Close fontSize="inherit" />
          </IconButton>
        }
      >
        <AlertTitle sx={{ fontWeight: 600, mb: 1 }}>
          {criticalCount > 0
            ? `${criticalCount} Critical Security ${criticalCount === 1 ? 'Alert' : 'Alerts'}`
            : `Security Alert`}
        </AlertTitle>

        <Typography variant="body2" sx={{ mb: 2 }}>
          {breachCount === 1 ? (
            <>
              One of your passwords has been found in a data breach.
              Change it immediately to protect your account.
            </>
          ) : (
            <>
              {breachCount} of your passwords have been found in data breaches.
              Review and update them to secure your accounts.
            </>
          )}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            color={severity}
            startIcon={<Visibility />}
            onClick={handleReview}
            sx={{
              backgroundColor: severity === 'error' ? 'error.main' : 'warning.main',
              '&:hover': {
                backgroundColor: severity === 'error' ? 'error.dark' : 'warning.dark',
              },
            }}
          >
            Review Breaches
          </Button>

          <Button
            size="small"
            variant="outlined"
            color={severity}
            startIcon={<Security />}
            onClick={() => navigate('/security')}
          >
            Security Audit
          </Button>
        </Box>
      </Alert>
    </Collapse>
  );
}
