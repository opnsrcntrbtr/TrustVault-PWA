/**
 * Update Notification Component
 * Non-intrusive banner for PWA updates
 *
 * Features:
 * - Bottom-anchored slide-up notification
 * - Version display (current → available)
 * - Update Now / Dismiss actions
 * - Installing state feedback
 * - Auto-show on update detection
 * - Cross-platform styling
 */

import { useState, useEffect, type ReactElement } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  Typography,
  CircularProgress,
  Slide,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import {
  SystemUpdate,
  Close,
  CheckCircle,
} from '@mui/icons-material';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';

function SlideTransition(props: TransitionProps & { children: ReactElement }) {
  return <Slide {...props} direction="up" appear={props.appear ?? true} />;
}

export default function UpdateNotification() {
  const {
    updateAvailable,
    updateInstalling,
    currentVersion,
    availableVersion,
    installUpdate,
    dismissUpdate,
  } = useServiceWorkerUpdate();

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Check for update completion on mount
  useEffect(() => {
    const wasUpdated = sessionStorage.getItem('sw-update-completed');
    if (wasUpdated === 'true') {
      sessionStorage.removeItem('sw-update-completed');
      setShowSuccessMessage(true);
      // Auto-hide after 5 seconds
      setTimeout(() => { setShowSuccessMessage(false); }, 5000);
    }
  }, []);

  const handleUpdateNow = async (): Promise<void> => {
    await installUpdate();
  };

  const handleDismiss = (): void => {
    dismissUpdate();
  };

  // Show success message after update
  if (showSuccessMessage) {
    return (
      <Snackbar
        open={true}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={SlideTransition}
        onClose={() => { setShowSuccessMessage(false); }}
        sx={{ bottom: { xs: 70, md: 24 } }} // Account for mobile navigation
      >
        <Alert
          severity="success"
          icon={<CheckCircle />}
          onClose={() => { setShowSuccessMessage(false); }}
          sx={{
            width: '100%',
            maxWidth: 600,
            boxShadow: 3,
          }}
        >
          <AlertTitle>Updated Successfully</AlertTitle>
          TrustVault has been updated to the latest version
          {availableVersion && ` (${availableVersion})`}
        </Alert>
      </Snackbar>
    );
  }

  // Show update notification
  if (!updateAvailable) {
    return null;
  }

  return (
    <Snackbar
      open={updateAvailable}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      TransitionComponent={SlideTransition}
      sx={{ bottom: { xs: 70, md: 24 } }} // Account for mobile navigation
    >
      <Alert
        severity="info"
        icon={<SystemUpdate />}
        sx={{
          width: '100%',
          maxWidth: 600,
          boxShadow: 3,
          '& .MuiAlert-action': {
            alignItems: 'flex-start',
            paddingTop: 0,
          },
        }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={handleDismiss}
            disabled={updateInstalling}
            startIcon={<Close />}
            sx={{ mt: -0.5 }}
          >
            Later
          </Button>
        }
      >
        <AlertTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>Update Available</span>
            {updateInstalling && (
              <CircularProgress size={16} color="inherit" />
            )}
          </Box>
        </AlertTitle>

        <Typography variant="body2" sx={{ mb: 1.5 }}>
          A new version of TrustVault is ready to install
          {currentVersion && availableVersion && (
            <Box component="span" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
              {currentVersion} → {availableVersion}
            </Box>
          )}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleUpdateNow}
            disabled={updateInstalling}
            startIcon={updateInstalling ? <CircularProgress size={16} /> : <SystemUpdate />}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            {updateInstalling ? 'Installing...' : 'Update Now'}
          </Button>
        </Box>

        {updateInstalling && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
            The page will reload automatically when the update is complete
          </Typography>
        )}
      </Alert>
    </Snackbar>
  );
}
