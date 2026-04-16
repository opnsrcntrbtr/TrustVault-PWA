/**
 * Password Generator Dialog Component
 * Modal for generating secure passwords with customizable options
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Slider,
  FormControlLabel,
  Checkbox,
  TextField,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { usePasswordGenerator } from '@/presentation/hooks/usePasswordGenerator';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import { copyPassword } from '@/presentation/utils/clipboard';
import { useState } from 'react';

interface PasswordGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  onUse: (password: string) => void;
}

export default function PasswordGeneratorDialog({
  open,
  onClose,
  onUse,
}: PasswordGeneratorDialogProps) {
  const {
    password,
    strength,
    options,
    generatePassword,
    setLength,
    toggleLowercase,
    toggleUppercase,
    toggleNumbers,
    toggleSymbols,
    toggleExcludeAmbiguous,
  } = usePasswordGenerator();

  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async () => {
    const success = await copyPassword(password, 30);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => { setCopySuccess(false); }, 2000);
    }
  };

  const handleUse = () => {
    onUse(password);
    onClose();
  };

  const handleLengthChange = (_: Event, value: number | number[]) => {
    const length = Array.isArray(value) ? value[0] : value;
    if (length !== undefined) {
      setLength(length);
    }
  };

  // Check if at least one character type is selected
  const hasValidSelection =
    options.lowercase || options.uppercase || options.numbers || options.symbols;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      {/* Header */}
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="div">
            Password Generator
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="close"
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Generated Password Display */}
          <Box>
            <TextField
              fullWidth
              value={password}
              InputProps={{
                readOnly: true,
                sx: {
                  fontFamily: 'monospace',
                  fontSize: '1.1rem',
                  letterSpacing: '0.5px',
                },
                endAdornment: (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={copySuccess ? 'Copied!' : 'Copy password'}>
                      <IconButton
                        size="small"
                        onClick={handleCopy}
                        color={copySuccess ? 'success' : 'default'}
                      >
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Generate new password">
                      <IconButton size="small" onClick={generatePassword} color="primary">
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ),
              }}
              multiline
              maxRows={3}
            />
          </Box>

          {/* Password Strength Indicator */}
          {strength && (
            <Box>
              <PasswordStrengthIndicator password={password} showFeedback={false} />
            </Box>
          )}

          {/* Length Slider */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Length
              </Typography>
              <Typography variant="body2" fontWeight="600">
                {options.length} characters
              </Typography>
            </Box>
            <Slider
              value={options.length}
              onChange={handleLengthChange}
              min={8}
              max={64}
              step={1}
              marks={[
                { value: 8, label: '8' },
                { value: 16, label: '16' },
                { value: 32, label: '32' },
                { value: 64, label: '64' },
              ]}
              sx={{
                '& .MuiSlider-markLabel': {
                  fontSize: '0.75rem',
                },
              }}
            />
          </Box>

          {/* Character Type Options */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Character Types
            </Typography>
            <Stack spacing={0.5}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.lowercase}
                    onChange={toggleLowercase}
                    disabled={!hasValidSelection && options.lowercase}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Lowercase (a-z)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      abcdefghijklmnopqrstuvwxyz
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.uppercase}
                    onChange={toggleUppercase}
                    disabled={!hasValidSelection && options.uppercase}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Uppercase (A-Z)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ABCDEFGHIJKLMNOPQRSTUVWXYZ
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.numbers}
                    onChange={toggleNumbers}
                    disabled={!hasValidSelection && options.numbers}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Numbers (0-9)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      0123456789
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.symbols}
                    onChange={toggleSymbols}
                    disabled={!hasValidSelection && options.symbols}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Symbols</Typography>
                    <Typography variant="caption" color="text.secondary">
                      !@#$%^&*()_+-=[]&#123;&#125;|;:,.&lt;&gt;?
                    </Typography>
                  </Box>
                }
              />
            </Stack>
          </Box>

          {/* Additional Options */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Additional Options
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.excludeAmbiguous}
                  onChange={toggleExcludeAmbiguous}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Exclude ambiguous characters</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Excludes: 0, O, o, I, i, l, 1, |
                  </Typography>
                </Box>
              }
            />
          </Box>

          {/* Warning if no character types selected */}
          {!hasValidSelection && (
            <Box
              sx={{
                p: 2,
                bgcolor: 'warning.main',
                color: 'warning.contrastText',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2">
                Please select at least one character type
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleUse} variant="contained" disabled={!hasValidSelection}>
          Use This Password
        </Button>
      </DialogActions>
    </Dialog>
  );
}
