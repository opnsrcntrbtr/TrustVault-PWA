/**
 * OcrResultDialog
 *
 * Confirmation dialog for reviewing and editing OCR-detected credential fields
 * before applying them to the credential form.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

import { sanitizeValue, type ParsedCredential } from '@/core/ocr';

export interface OcrResultDialogProps {
  open: boolean;
  result: ParsedCredential | null;
  onClose: () => void;
  onApply: (fields: {
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
  }) => void;
  onRescan: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) {
    return (
      <Chip
        icon={<CheckCircleIcon />}
        label="High confidence"
        size="small"
        color="success"
        variant="outlined"
      />
    );
  }
  if (confidence >= 0.5) {
    return (
      <Chip
        icon={<WarningIcon />}
        label="Verify"
        size="small"
        color="warning"
        variant="outlined"
      />
    );
  }
  if (confidence > 0) {
    return (
      <Chip
        icon={<InfoIcon />}
        label="Low confidence"
        size="small"
        color="default"
        variant="outlined"
      />
    );
  }
  return null;
}

export function OcrResultDialog({
  open,
  result,
  onClose,
  onApply,
  onRescan,
}: OcrResultDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Update form when result changes
  useEffect(() => {
    if (result) {
      setUsername(sanitizeValue(result.username ?? ''));
      setPassword(sanitizeValue(result.password ?? ''));
      setUrl(sanitizeValue(result.url ?? ''));
      setNotes(sanitizeValue(result.notes ?? ''));
    }
  }, [result]);

  const handleApply = () => {
    const fields: {
      username?: string;
      password?: string;
      url?: string;
      notes?: string;
    } = {};

    if (username.trim()) fields.username = username.trim();
    if (password.trim()) fields.password = password.trim();
    if (url.trim()) fields.url = url.trim();
    if (notes.trim()) fields.notes = notes.trim();

    onApply(fields);
    onClose();
  };

  const hasAnyField =
    username.trim() || password.trim() || url.trim() || notes.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review Detected Fields</DialogTitle>

      <DialogContent>
        {result && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Review and edit the detected fields before applying them to the
              form. Always verify passwords are correct.
            </Alert>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Username/Email */}
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Username / Email
                  </Typography>
                  {result.confidence.username > 0 && (
                    <ConfidenceBadge confidence={result.confidence.username} />
                  )}
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); }}
                  placeholder="Not detected"
                />
              </Box>

              {/* Password */}
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Password
                  </Typography>
                  {result.confidence.password > 0 && (
                    <ConfidenceBadge confidence={result.confidence.password} />
                  )}
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); }}
                  placeholder="Not detected"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => { setShowPassword(!showPassword); }}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? (
                            <VisibilityOffIcon />
                          ) : (
                            <VisibilityIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                {result.confidence.password > 0 &&
                  result.confidence.password < 0.8 && (
                    <Typography
                      variant="caption"
                      color="warning.main"
                      sx={{ mt: 0.5, display: 'block' }}
                    >
                      ⚠️ Please verify the password is correct before saving
                    </Typography>
                  )}
              </Box>

              {/* URL */}
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Website URL
                  </Typography>
                  {result.confidence.url > 0 && (
                    <ConfidenceBadge confidence={result.confidence.url} />
                  )}
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); }}
                  placeholder="Not detected"
                />
              </Box>

              {/* Notes */}
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Notes
                  </Typography>
                  {result.confidence.notes > 0 && (
                    <ConfidenceBadge confidence={result.confidence.notes} />
                  )}
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); }}
                  placeholder="Not detected"
                />
              </Box>
            </Box>

            {!hasAnyField && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                No fields were detected. Try rescanning with better lighting or
                positioning.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onRescan} color="inherit">
          Rescan
        </Button>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={!hasAnyField}
        >
          Apply to Form
        </Button>
      </DialogActions>
    </Dialog>
  );
}
