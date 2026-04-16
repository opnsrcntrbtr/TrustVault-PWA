/**
 * Password Generator Page Component
 * Dedicated page for generating secure passwords and passphrases
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Card,
  CardContent,
  TextField,
  Slider,
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
  Stack,
  Chip,
  Switch,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import {
  generatePassword,
  generatePronounceablePassword,
  type PasswordGeneratorOptions,
} from '@/features/vault/generator/passwordGenerator';
import {
  generatePassphrase,
  getDefaultPassphraseOptions,
  type PassphraseOptions,
} from '@/features/vault/generator/passphraseGenerator';
import { copyPassword } from '@/presentation/utils/clipboard';

type GeneratorType = 'password' | 'passphrase' | 'pronounceable';

export default function PasswordGeneratorPage() {
  const navigate = useNavigate();

  // Generator type selection
  const [generatorType, setGeneratorType] = useState<GeneratorType>('password');

  // Password generator state
  const [passwordOptions, setPasswordOptions] = useState<PasswordGeneratorOptions>({
    length: 20,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: false,
  });

  // Passphrase generator state
  const [passphraseOptions, setPassphraseOptions] = useState<PassphraseOptions>(
    getDefaultPassphraseOptions()
  );

  // Pronounceable password length
  const [pronounceableLength, setPronounceableLength] = useState(16);

  // Generated output
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [entropy, setEntropy] = useState(0);
  const [strength, setStrength] = useState<'weak' | 'medium' | 'strong' | 'very-strong'>('weak');

  // Copy state
  const [copySuccess, setCopySuccess] = useState(false);

  // Generate password/passphrase
  const handleGenerate = useCallback(() => {
    let result;

    switch (generatorType) {
      case 'password':
        result = generatePassword(passwordOptions);
        break;
      case 'passphrase':
        result = generatePassphrase(passphraseOptions);
        break;
      case 'pronounceable':
        result = generatePronounceablePassword(pronounceableLength);
        break;
      default:
        result = generatePassword(passwordOptions);
    }

    setGeneratedPassword(result.password);
    setEntropy(result.entropy);
    setStrength(result.strength);
  }, [generatorType, passwordOptions, passphraseOptions, pronounceableLength]);

  // Generate initial password on mount
  useEffect(() => {
    handleGenerate();
  }, [handleGenerate]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    const success = await copyPassword(generatedPassword, 30);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => { setCopySuccess(false); }, 2000);
    }
  };

  // Update password options
  const updatePasswordOptions = (updates: Partial<PasswordGeneratorOptions>) => {
    setPasswordOptions((prev) => ({ ...prev, ...updates }));
  };

  // Update passphrase options
  const updatePassphraseOptions = (updates: Partial<PassphraseOptions>) => {
    setPassphraseOptions((prev) => ({ ...prev, ...updates }));
  };

  // Get strength color
  const getStrengthColor = () => {
    switch (strength) {
      case 'very-strong':
        return '#4caf50'; // Green
      case 'strong':
        return '#8bc34a'; // Light green
      case 'medium':
        return '#ff9800'; // Orange
      case 'weak':
        return '#f44336'; // Red
      default:
        return '#9e9e9e'; // Gray
    }
  };

  // Get strength label
  const getStrengthLabel = () => {
    switch (strength) {
      case 'very-strong':
        return 'Very Strong';
      case 'strong':
        return 'Strong';
      case 'medium':
        return 'Medium';
      case 'weak':
        return 'Weak';
      default:
        return 'Unknown';
    }
  };

  // Check if password options are valid
  const hasValidPasswordOptions =
    passwordOptions.includeUppercase ||
    passwordOptions.includeLowercase ||
    passwordOptions.includeNumbers ||
    passwordOptions.includeSymbols;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/dashboard')}
            aria-label="back"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="h1" sx={{ ml: 2, flexGrow: 1 }}>
            Password Generator
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        {/* Generated Password Display */}
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              value={generatedPassword}
              InputProps={{
                readOnly: true,
                sx: {
                  fontFamily: 'monospace',
                  fontSize: '1.2rem',
                  letterSpacing: '0.5px',
                  fontWeight: 500,
                },
              }}
              multiline
              maxRows={4}
              sx={{ mb: 2 }}
            />

            {/* Actions */}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                startIcon={copySuccess ? <CheckIcon /> : <CopyIcon />}
                onClick={handleCopy}
                color={copySuccess ? 'success' : 'primary'}
                fullWidth
              >
                {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleGenerate}
                fullWidth
              >
                Regenerate
              </Button>
            </Stack>

            {/* Strength Indicator */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Strength
                </Typography>
                <Box
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${Math.min((entropy / 128) * 100, 100)}%`,
                      bgcolor: getStrengthColor(),
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
              </Box>
              <Chip
                label={getStrengthLabel()}
                size="small"
                sx={{
                  bgcolor: getStrengthColor(),
                  color: 'white',
                  fontWeight: 600,
                  minWidth: 100,
                }}
              />
            </Box>

            {/* Entropy Display */}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Entropy: {entropy.toFixed(1)} bits
            </Typography>
          </CardContent>
        </Card>

        {/* Generator Type Tabs */}
        <Card elevation={1} sx={{ mb: 3 }}>
          <Tabs
            value={generatorType}
            onChange={(_, value) => {
              setGeneratorType(value as GeneratorType);
              handleGenerate();
            }}
            variant="fullWidth"
          >
            <Tab label="Password" value="password" />
            <Tab label="Passphrase" value="passphrase" />
            <Tab label="Pronounceable" value="pronounceable" />
          </Tabs>
        </Card>

        {/* Password Generator Options */}
        {generatorType === 'password' && (
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Password Options
              </Typography>

              {/* Length Slider */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Length
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {passwordOptions.length} characters
                  </Typography>
                </Box>
                <Slider
                  value={passwordOptions.length}
                  onChange={(_, value) => {
                    updatePasswordOptions({ length: value as number });
                  }}
                  min={8}
                  max={128}
                  step={1}
                  marks={[
                    { value: 8, label: '8' },
                    { value: 32, label: '32' },
                    { value: 64, label: '64' },
                    { value: 128, label: '128' },
                  ]}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Character Types */}
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Character Types
              </Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={passwordOptions.includeUppercase}
                      onChange={(e) =>
                        { updatePasswordOptions({ includeUppercase: e.target.checked }); }
                      }
                      disabled={!hasValidPasswordOptions && passwordOptions.includeUppercase}
                    />
                  }
                  label="Uppercase (A-Z)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={passwordOptions.includeLowercase}
                      onChange={(e) =>
                        { updatePasswordOptions({ includeLowercase: e.target.checked }); }
                      }
                      disabled={!hasValidPasswordOptions && passwordOptions.includeLowercase}
                    />
                  }
                  label="Lowercase (a-z)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={passwordOptions.includeNumbers}
                      onChange={(e) => { updatePasswordOptions({ includeNumbers: e.target.checked }); }}
                      disabled={!hasValidPasswordOptions && passwordOptions.includeNumbers}
                    />
                  }
                  label="Numbers (0-9)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={passwordOptions.includeSymbols}
                      onChange={(e) => { updatePasswordOptions({ includeSymbols: e.target.checked }); }}
                      disabled={!hasValidPasswordOptions && passwordOptions.includeSymbols}
                    />
                  }
                  label="Symbols (!@#$...)"
                />
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Additional Options */}
              <FormControlLabel
                control={
                  <Switch
                    checked={passwordOptions.excludeAmbiguous}
                    onChange={(e) =>
                      { updatePasswordOptions({ excludeAmbiguous: e.target.checked }); }
                    }
                  />
                }
                label="Exclude ambiguous characters (0, O, l, 1, I, |)"
              />

              {!hasValidPasswordOptions && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Please select at least one character type
                </Alert>
              )}

              <Button
                variant="contained"
                fullWidth
                onClick={handleGenerate}
                disabled={!hasValidPasswordOptions}
                sx={{ mt: 2 }}
              >
                Generate Password
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Passphrase Generator Options */}
        {generatorType === 'passphrase' && (
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Passphrase Options
              </Typography>

              {/* Word Count Slider */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Number of Words
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {passphraseOptions.wordCount} words
                  </Typography>
                </Box>
                <Slider
                  value={passphraseOptions.wordCount}
                  onChange={(_, value) => {
                    updatePassphraseOptions({ wordCount: value as number });
                  }}
                  min={4}
                  max={8}
                  step={1}
                  marks
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Separator */}
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Word Separator
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip
                  label="Dash (-)"
                  onClick={() => { updatePassphraseOptions({ separator: 'dash' }); }}
                  color={passphraseOptions.separator === 'dash' ? 'primary' : 'default'}
                  variant={passphraseOptions.separator === 'dash' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Space"
                  onClick={() => { updatePassphraseOptions({ separator: 'space' }); }}
                  color={passphraseOptions.separator === 'space' ? 'primary' : 'default'}
                  variant={passphraseOptions.separator === 'space' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Symbols"
                  onClick={() => { updatePassphraseOptions({ separator: 'symbol' }); }}
                  color={passphraseOptions.separator === 'symbol' ? 'primary' : 'default'}
                  variant={passphraseOptions.separator === 'symbol' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="None"
                  onClick={() => { updatePassphraseOptions({ separator: 'none' }); }}
                  color={passphraseOptions.separator === 'none' ? 'primary' : 'default'}
                  variant={passphraseOptions.separator === 'none' ? 'filled' : 'outlined'}
                />
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Capitalization */}
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Capitalization
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip
                  label="None"
                  onClick={() => { updatePassphraseOptions({ capitalize: 'none' }); }}
                  color={passphraseOptions.capitalize === 'none' ? 'primary' : 'default'}
                  variant={passphraseOptions.capitalize === 'none' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="First"
                  onClick={() => { updatePassphraseOptions({ capitalize: 'first' }); }}
                  color={passphraseOptions.capitalize === 'first' ? 'primary' : 'default'}
                  variant={passphraseOptions.capitalize === 'first' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="All"
                  onClick={() => { updatePassphraseOptions({ capitalize: 'all' }); }}
                  color={passphraseOptions.capitalize === 'all' ? 'primary' : 'default'}
                  variant={passphraseOptions.capitalize === 'all' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Random"
                  onClick={() => { updatePassphraseOptions({ capitalize: 'random' }); }}
                  color={passphraseOptions.capitalize === 'random' ? 'primary' : 'default'}
                  variant={passphraseOptions.capitalize === 'random' ? 'filled' : 'outlined'}
                />
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Include Numbers */}
              <FormControlLabel
                control={
                  <Switch
                    checked={passphraseOptions.includeNumbers}
                    onChange={(e) => { updatePassphraseOptions({ includeNumbers: e.target.checked }); }}
                  />
                }
                label="Include numbers (2-4 digits)"
              />

              <Button variant="contained" fullWidth onClick={handleGenerate} sx={{ mt: 2 }}>
                Generate Passphrase
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pronounceable Password Options */}
        {generatorType === 'pronounceable' && (
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pronounceable Password Options
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                Pronounceable passwords use alternating consonants and vowels for easier
                memorization
              </Alert>

              {/* Length Slider */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Length
                  </Typography>
                  <Typography variant="body2" fontWeight="600">
                    {pronounceableLength} characters
                  </Typography>
                </Box>
                <Slider
                  value={pronounceableLength}
                  onChange={(_, value) => {
                    setPronounceableLength(value as number);
                  }}
                  min={8}
                  max={32}
                  step={1}
                  marks={[
                    { value: 8, label: '8' },
                    { value: 16, label: '16' },
                    { value: 24, label: '24' },
                    { value: 32, label: '32' },
                  ]}
                />
              </Box>

              <Button variant="contained" fullWidth onClick={handleGenerate} sx={{ mt: 2 }}>
                Generate Pronounceable Password
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Box */}
        <Paper elevation={0} sx={{ p: 2, mt: 3, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Security Note:</strong> All passwords are generated using cryptographically
            secure random number generators. Passwords are not stored in history. When copied, they
            are automatically cleared from clipboard after 30 seconds.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
