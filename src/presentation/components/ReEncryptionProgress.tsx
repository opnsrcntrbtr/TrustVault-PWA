/**
 * Re-encryption Progress Component
 * Shows progress during credential re-encryption
 */

import { Box, LinearProgress, Typography, CircularProgress } from '@mui/material';
import { Lock } from '@mui/icons-material';

interface ReEncryptionProgressProps {
  current: number;
  total: number;
}

export default function ReEncryptionProgress({ current, total }: ReEncryptionProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        px: 2,
      }}
    >
      {/* Lock Icon with Spinner */}
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
        <CircularProgress size={80} />
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
          <Lock sx={{ fontSize: 40, color: 'primary.main' }} />
        </Box>
      </Box>

      {/* Title */}
      <Typography variant="h6" gutterBottom>
        Re-encrypting Credentials
      </Typography>

      {/* Progress Text */}
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {current} of {total} credentials processed
      </Typography>

      {/* Progress Bar */}
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: 8,
            borderRadius: 1,
            backgroundColor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 1,
            },
          }}
        />
      </Box>

      {/* Percentage */}
      <Typography variant="h4" sx={{ mt: 2, fontWeight: 600, color: 'primary.main' }}>
        {percentage}%
      </Typography>

      {/* Warning */}
      <Typography
        variant="caption"
        color="text.secondary"
        align="center"
        sx={{ mt: 3, maxWidth: 400 }}
      >
        Please do not close this window or navigate away. This process cannot be interrupted.
      </Typography>
    </Box>
  );
}
