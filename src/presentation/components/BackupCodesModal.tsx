import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Grid,
  Paper,
  IconButton,
  Snackbar,
  Tooltip,
} from '@mui/material';
import { ContentCopy, Download } from '@mui/icons-material';
import type { BackupCode } from '@/domain/entities/Credential';

export interface BackupCodesModalProps {
  codes: BackupCode[];
  onConfirm: () => void;
  title?: string;
}

export default function BackupCodesModal({
  codes,
  onConfirm,
  title = 'Save your backup codes',
}: BackupCodesModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedMessage('Code copied!');
      setTimeout(() => setCopiedMessage(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleCopyAll = async () => {
    try {
      const allCodes = codes.map((bc) => bc.code).join(' ');
      await navigator.clipboard.writeText(allCodes);
      setCopiedMessage('All codes copied!');
      setTimeout(() => setCopiedMessage(null), 2000);
    } catch (err) {
      console.error('Failed to copy codes:', err);
    }
  };

  const handleDownload = () => {
    try {
      const content = codes.map((bc) => bc.code).join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download codes:', err);
    }
  };

  return (
    <Dialog open maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Keep these safe.</strong> Each code can only be used once. If you lose your
            authenticator, use these to regain access.
          </Typography>
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Your backup codes:
        </Typography>

        <Grid container spacing={1} sx={{ mb: 3 }}>
          {codes.map((bc) => (
            <Grid item xs={6} key={bc.id}>
              <Paper
                sx={{
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'monospace',
                  fontSize: '0.95rem',
                  backgroundColor: 'background.default',
                }}
              >
                <span>{bc.code}</span>
                <Tooltip title="Copy">
                  <IconButton
                    size="small"
                    onClick={() => handleCopyCode(bc.code)}
                    sx={{ ml: 1 }}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button variant="outlined" size="small" onClick={handleCopyAll} fullWidth>
            Copy all
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleDownload}
            startIcon={<Download />}
            fullWidth
          >
            Download
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            id="backup-confirm"
          />
          <label htmlFor="backup-confirm" style={{ margin: 0 }}>
            <Typography variant="body2">I've saved these codes</Typography>
          </label>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onConfirm} variant="contained" disabled={!confirmed}>
          Done
        </Button>
      </DialogActions>

      <Snackbar
        open={!!copiedMessage}
        autoHideDuration={2000}
        message={copiedMessage}
        onClose={() => setCopiedMessage(null)}
      />
    </Dialog>
  );
}
