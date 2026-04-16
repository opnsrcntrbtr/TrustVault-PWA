/**
 * Add Credential Page
 * Form to create a new credential entry
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  MenuItem,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  Alert,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  ArrowBack,
  Save,
  AutoAwesome,
  CameraAlt,
} from '@mui/icons-material';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { useAuthStore } from '@/presentation/store/authStore';
import PasswordStrengthIndicator from '@/presentation/components/PasswordStrengthIndicator';
import PasswordGeneratorDialog from '@/presentation/components/PasswordGeneratorDialog';
import TotpDisplay from '@/presentation/components/TotpDisplay';
import TagInput from '@/presentation/components/TagInput';
import { isValidTOTPSecret } from '@/core/auth/totp';
import type { CredentialCategory } from '@/domain/entities/Credential';
import {
  storeCredentialInBrowser,
  toBrowserCredential,
  isCredentialManagementSupported,
} from '@/core/autofill/credentialManagementService';
import { CameraScanDialog } from '@/presentation/components/CameraScanDialog';
import { OcrResultDialog } from '@/presentation/components/OcrResultDialog';
import { isCameraSupported, type ParsedCredential } from '@/core/ocr';

const CATEGORIES: { value: CredentialCategory; label: string }[] = [
  { value: 'login', label: 'Login' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'secure_note', label: 'Secure Note' },
  { value: 'identity', label: 'Identity' },
  { value: 'api_key', label: 'API Key' },
  { value: 'ssh_key', label: 'SSH Key' },
];

export default function AddCredentialPage() {
  const navigate = useNavigate();
  const { vaultKey } = useAuthStore();

  // Form state
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<CredentialCategory>('login');
  const [tags, setTags] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');

  // Card-specific state
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardType, setCardType] = useState<'visa' | 'mastercard' | 'amex' | 'discover' | 'other'>('visa');
  const [billingAddress, setBillingAddress] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  // OCR scan state
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [ocrResultDialogOpen, setOcrResultDialogOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState<ParsedCredential | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    // For credit cards, validate card-specific fields instead of username/password
    if (category === 'credit_card') {
      if (!cardNumber.trim()) {
        newErrors.cardNumber = 'Card number is required';
      } else if (!/^\d{13,19}$/.test(cardNumber.replace(/\s/g, ''))) {
        newErrors.cardNumber = 'Invalid card number format';
      }

      if (!cardholderName.trim()) {
        newErrors.cardholderName = 'Cardholder name is required';
      }

      if (!expiryMonth || !expiryYear) {
        newErrors.expiry = 'Expiration date is required';
      }

      if (!cvv.trim()) {
        newErrors.cvv = 'CVV is required';
      } else if (!/^\d{3,4}$/.test(cvv)) {
        newErrors.cvv = 'Invalid CVV format';
      }
    } else {
      // Standard validation for non-card credentials
      if (!username.trim()) {
        newErrors.username = 'Username is required';
      }

      if (!password) {
        newErrors.password = 'Password is required';
      } else if (password.length < 4) {
        newErrors.password = 'Password must be at least 4 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGeneratePassword = () => {
    setGeneratorOpen(true);
  };

  const handleUseGeneratedPassword = (generatedPassword: string) => {
    setPassword(generatedPassword);
  };

  // OCR scan handlers
  const handleOpenScan = () => {
    setScanDialogOpen(true);
  };

  const handleScanResult = (result: ParsedCredential) => {
    setOcrResult(result);
    setScanDialogOpen(false);
    setOcrResultDialogOpen(true);
  };

  const handleApplyOcrResult = (fields: {
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
  }) => {
    if (fields.username) setUsername(fields.username);
    if (fields.password) setPassword(fields.password);
    if (fields.url) setUrl(fields.url);
    if (fields.notes) setNotes(fields.notes);
    setOcrResultDialogOpen(false);
  };

  const handleRescan = () => {
    setOcrResultDialogOpen(false);
    setScanDialogOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (!vaultKey) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const inputData: any = {
        title: title.trim(),
        category,
        tags,
        url: url.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      // Add card-specific fields for credit cards
      if (category === 'credit_card') {
        inputData.username = cardholderName.trim(); // Store cardholder name as username
        inputData.password = 'N/A'; // Placeholder for required field
        inputData.cardNumber = cardNumber.replace(/\s/g, '');
        inputData.cardholderName = cardholderName.trim();
        inputData.expiryMonth = expiryMonth;
        inputData.expiryYear = expiryYear;
        inputData.cvv = cvv;
        inputData.cardType = cardType;
        inputData.billingAddress = billingAddress.trim() || undefined;
      } else {
        // Standard credential fields
        inputData.username = username.trim();
        inputData.password = password;
        inputData.totpSecret = totpSecret.trim() || undefined;
      }

      const credential = await credentialRepository.create(inputData, vaultKey);

      // Update favorite status after creation if needed
      if (isFavorite) {
        await credentialRepository.update(credential.id, { isFavorite: true }, vaultKey);
      }

      // Store credential in browser for autofill (if supported and applicable)
      if (
        credential.category === 'login' &&
        credential.url &&
        isCredentialManagementSupported()
      ) {
        try {
          const browserCred = toBrowserCredential(credential);
          if (browserCred) {
            await storeCredentialInBrowser(browserCred);
          }
        } catch (err) {
          // Non-critical: autofill storage failed, but credential was saved
          console.warn('Failed to store credential in browser for autofill:', err);
        }
      }

      // Navigate back to dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to save credential:', err);
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, flex: 1 }}>
            Add Credential
          </Typography>
          {isCameraSupported() && (
            <Button
              variant="outlined"
              startIcon={<CameraAlt />}
              onClick={handleOpenScan}
              size="small"
            >
              Scan
            </Button>
          )}
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => { setError(null); }}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <Box component="form" noValidate>
          {/* Title */}
          <TextField
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); }}
            error={!!errors.title}
            helperText={errors.title}
            margin="normal"
            required
            placeholder="e.g., Gmail Account, Work VPN"
          />

          {/* Category */}
          <TextField
            fullWidth
            select
            label="Category"
            value={category}
            onChange={(e) => { setCategory(e.target.value as CredentialCategory); }}
            margin="normal"
          >
            {CATEGORIES.map((cat) => (
              <MenuItem key={cat.value} value={cat.value}>
                {cat.label}
              </MenuItem>
            ))}
          </TextField>

          {/* Conditional Fields based on Category */}
          {category === 'credit_card' ? (
            <>
              {/* Card Number */}
              <TextField
                fullWidth
                label="Card Number"
                value={cardNumber}
                onChange={(e) => { setCardNumber(e.target.value); }}
                error={!!errors.cardNumber}
                helperText={errors.cardNumber}
                margin="normal"
                required
                placeholder="1234 5678 9012 3456"
                inputProps={{ maxLength: 19 }}
              />

              {/* Cardholder Name */}
              <TextField
                fullWidth
                label="Cardholder Name"
                value={cardholderName}
                onChange={(e) => { setCardholderName(e.target.value); }}
                error={!!errors.cardholderName}
                helperText={errors.cardholderName}
                margin="normal"
                required
                placeholder="JOHN DOE"
              />

              {/* Card Type */}
              <TextField
                fullWidth
                select
                label="Card Type"
                value={cardType}
                onChange={(e) => { setCardType(e.target.value as typeof cardType); }}
                margin="normal"
              >
                <MenuItem value="visa">Visa</MenuItem>
                <MenuItem value="mastercard">Mastercard</MenuItem>
                <MenuItem value="amex">American Express</MenuItem>
                <MenuItem value="discover">Discover</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>

              {/* Expiry Date */}
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <TextField
                  select
                  label="Expiry Month"
                  value={expiryMonth}
                  onChange={(e) => { setExpiryMonth(e.target.value); }}
                  error={!!errors.expiry}
                  required
                  sx={{ flex: 1 }}
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = String(i + 1).padStart(2, '0');
                    return (
                      <MenuItem key={month} value={month}>
                        {month}
                      </MenuItem>
                    );
                  })}
                </TextField>

                <TextField
                  select
                  label="Expiry Year"
                  value={expiryYear}
                  onChange={(e) => { setExpiryYear(e.target.value); }}
                  error={!!errors.expiry}
                  required
                  sx={{ flex: 1 }}
                >
                  {Array.from({ length: 15 }, (_, i) => {
                    const year = String(new Date().getFullYear() + i);
                    return (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    );
                  })}
                </TextField>
              </Box>
              {errors.expiry && (
                <Typography color="error" variant="caption" sx={{ mt: 1, ml: 2 }}>
                  {errors.expiry}
                </Typography>
              )}

              {/* CVV */}
              <TextField
                fullWidth
                label="CVV / Security Code"
                type={showPassword ? 'text' : 'password'}
                value={cvv}
                onChange={(e) => { setCvv(e.target.value); }}
                error={!!errors.cvv}
                helperText={errors.cvv}
                margin="normal"
                required
                placeholder="123"
                inputProps={{ maxLength: 4 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => { setShowPassword(!showPassword); }}
                        edge="end"
                        title={showPassword ? 'Hide CVV' : 'Show CVV'}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Billing Address */}
              <TextField
                fullWidth
                label="Billing Address (Optional)"
                value={billingAddress}
                onChange={(e) => { setBillingAddress(e.target.value); }}
                margin="normal"
                multiline
                rows={2}
                placeholder="123 Main St, City, State ZIP"
              />
            </>
          ) : (
            <>
              {/* Username */}
              <TextField
                fullWidth
                label="Username / Email"
                value={username}
                onChange={(e) => { setUsername(e.target.value); }}
                error={!!errors.username}
                helperText={errors.username}
                margin="normal"
                required
                placeholder="user@example.com"
              />

              {/* Password */}
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); }}
                error={!!errors.password}
                helperText={errors.password}
                margin="normal"
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handleGeneratePassword}
                        edge="end"
                        title="Generate password"
                        sx={{ mr: 1 }}
                      >
                        <AutoAwesome />
                      </IconButton>
                      <IconButton
                        onClick={() => { setShowPassword(!showPassword); }}
                        edge="end"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Password Strength Indicator */}
              <PasswordStrengthIndicator password={password} showFeedback />

              {/* TOTP Secret (2FA) */}
              <TextField
                fullWidth
                label="TOTP Secret (Optional)"
                value={totpSecret}
                onChange={(e) => { setTotpSecret(e.target.value); }}
                margin="normal"
                placeholder="Base32-encoded secret (e.g., from Google Authenticator)"
                helperText="Enter the base32-encoded secret key for 2FA/TOTP authentication"
              />

              {/* TOTP Preview */}
              {totpSecret.trim() && isValidTOTPSecret(totpSecret.trim()) && (
                <Box sx={{ mt: 2 }}>
                  <TotpDisplay totpSecret={totpSecret.trim()} />
                </Box>
              )}

              {totpSecret.trim() && !isValidTOTPSecret(totpSecret.trim()) && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Invalid TOTP secret format. Please enter a valid base32-encoded secret.
                </Alert>
              )}
            </>
          )}

          {/* URL */}
          <TextField
            fullWidth
            label="Website URL"
            value={url}
            onChange={(e) => { setUrl(e.target.value); }}
            margin="normal"
            placeholder="https://example.com"
            type="url"
          />

          {/* Tags */}
          <Box sx={{ mt: 2, mb: 1 }}>
            <TagInput tags={tags} onChange={setTags} />
          </Box>

          {/* Notes */}
          <TextField
            fullWidth
            label="Notes"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); }}
            margin="normal"
            multiline
            rows={4}
            placeholder="Additional information..."
          />

          {/* Favorite Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={isFavorite}
                onChange={(e) => { setIsFavorite(e.target.checked); }}
              />
            }
            label="Add to favorites"
            sx={{ mt: 2 }}
          />

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={loading}
              startIcon={<Save />}
              fullWidth
            >
              {loading ? 'Saving...' : 'Save Credential'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Password Generator Dialog */}
      <PasswordGeneratorDialog
        open={generatorOpen}
        onClose={() => { setGeneratorOpen(false); }}
        onUse={handleUseGeneratedPassword}
      />

      {/* Camera Scan Dialog */}
      <CameraScanDialog
        open={scanDialogOpen}
        onClose={() => { setScanDialogOpen(false); }}
        onResult={handleScanResult}
      />

      {/* OCR Result Dialog */}
      <OcrResultDialog
        open={ocrResultDialogOpen}
        result={ocrResult}
        onClose={() => { setOcrResultDialogOpen(false); }}
        onApply={handleApplyOcrResult}
        onRescan={handleRescan}
      />
    </Container>
  );
}
