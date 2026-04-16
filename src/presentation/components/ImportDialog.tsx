/**
 * Import Dialog Component
 * Allows users to import encrypted vault backups
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Box,
  IconButton,
  InputAdornment,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, Upload, Warning } from '@mui/icons-material';
import { decryptImport, readImportFile } from '@/core/crypto/exportEncryption';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { useAuthStore } from '../store/authStore';
import { Credential, CredentialInput } from '@/domain/entities/Credential';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

type ImportMode = 'replace' | 'merge';

export default function ImportDialog({ open, onClose, onSuccess }: ImportDialogProps) {
  const { session } = useAuthStore();

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);

  // Form state
  const [exportPassword, setExportPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [decrypted, setDecrypted] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith('.tvault')) {
      setError('Invalid file type. Please select a .tvault file.');
      return;
    }

    setSelectedFile(file);
    setError(null);

    try {
      const content = await readImportFile(file);
      setFileContent(content);
    } catch (err) {
      setError('Failed to read file');
      setSelectedFile(null);
    }
  };

  const handleDecrypt = async () => {
    if (!fileContent || !exportPassword) return;

    setError(null);
    setDecrypting(true);

    try {
      // Decrypt and parse import
      const importedCredentials = await decryptImport(fileContent, exportPassword);

      setCredentials(importedCredentials);
      setDecrypted(true);
      setDecrypting(false);
    } catch (err) {
      console.error('Decryption failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to decrypt import file');
      setDecrypting(false);
    }
  };

  const handleImport = async () => {
    if (!session?.vaultKey || credentials.length === 0) return;

    setError(null);
    setImporting(true);
    setProgress({ current: 0, total: credentials.length });

    try {
      // Replace mode: delete all existing credentials first
      if (importMode === 'replace') {
        const existing = await credentialRepository.findAll(session.vaultKey);
        for (const cred of existing) {
          await credentialRepository.delete(cred.id);
        }
      }

      // Import credentials
      for (let i = 0; i < credentials.length; i++) {
        const credential = credentials[i];

        // In merge mode, check for duplicates (same title + username)
        if (importMode === 'merge') {
          const existing = await credentialRepository.findAll(session.vaultKey);
          const duplicate = existing.find(
            (c) =>
              c.title.toLowerCase() === credential!.title.toLowerCase() &&
              c.username.toLowerCase() === credential!.username.toLowerCase()
          );

          if (duplicate) {
            // Skip duplicate
            setProgress({ current: i + 1, total: credentials.length });
            continue;
          }
        }

        // Generate new ID for imported credential and ensure required fields
        const newCredential: CredentialInput = {
          title: credential!.title ?? 'Untitled',
          username: credential!.username ?? '',
          password: credential!.password ?? '',
          url: credential!.url,
          notes: credential!.notes,
          category: credential!.category ?? 'login',
          tags: credential!.tags,
          isFavorite: credential!.isFavorite,
          totpSecret: credential!.totpSecret,
        };

        // Save credential
        await credentialRepository.create(newCredential, session.vaultKey);

        // Update progress
        setProgress({ current: i + 1, total: credentials.length });
      }

      // Success
      setImporting(false);
      onSuccess(credentials.length);
      handleClose();
    } catch (err) {
      console.error('Import failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to import credentials');
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (decrypting || importing) return; // Don't allow closing during processing
    setSelectedFile(null);
    setFileContent(null);
    setCredentials([]);
    setExportPassword('');
    setImportMode('merge');
    setDecrypted(false);
    setError(null);
    setProgress({ current: 0, total: 0 });
    onClose();
  };

  const percentage =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Vault</DialogTitle>

      <DialogContent>
        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); }}>
            {error}
          </Alert>
        )}

        {/* Import Progress */}
        {importing ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 4,
            }}
          >
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Importing Credentials
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {progress.current} of {progress.total} credentials imported
            </Typography>
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress variant="determinate" value={percentage} sx={{ height: 8 }} />
            </Box>
            <Typography variant="h4" sx={{ mt: 2, color: 'primary.main' }}>
              {percentage}%
            </Typography>
          </Box>
        ) : (
          <>
            {/* File Selection */}
            {!decrypted && (
              <>
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    Select a .tvault backup file and enter the export password used when creating
                    the backup.
                  </Typography>
                </Alert>

                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<Upload />}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {selectedFile ? selectedFile.name : 'Select Backup File (.tvault)'}
                  <input
                    type="file"
                    hidden
                    accept=".tvault"
                    onChange={handleFileSelect}
                  />
                </Button>

                {/* Export Password */}
                {selectedFile && (
                  <TextField
                    label="Export Password"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    value={exportPassword}
                    onChange={(e) => { setExportPassword(e.target.value); }}
                    disabled={decrypting}
                    margin="normal"
                    helperText="Enter the password used to encrypt this backup"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => { setShowPassword(!showPassword); }} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              </>
            )}

            {/* Decryption Success - Show Import Options */}
            {decrypted && (
              <>
                <Alert severity="success" sx={{ mb: 3 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {credentials.length} credentials found
                  </Typography>
                  <Typography variant="caption">
                    Choose how to import these credentials into your vault.
                  </Typography>
                </Alert>

                {/* Import Mode */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Import Mode</InputLabel>
                  <Select
                    value={importMode}
                    label="Import Mode"
                    onChange={(e) => { setImportMode(e.target.value as ImportMode); }}
                  >
                    <MenuItem value="merge">
                      <Box>
                        <Typography variant="body2">Merge (Recommended)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Keep existing credentials and add new ones. Duplicates are skipped.
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="replace">
                      <Box>
                        <Typography variant="body2">Replace All</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Delete all existing credentials and replace with imported ones.
                        </Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

                {/* Warning for Replace Mode */}
                {importMode === 'replace' && (
                  <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Warning: Replace Mode
                    </Typography>
                    <Typography variant="caption">
                      This will permanently delete all your existing credentials before importing.
                      This action cannot be undone.
                    </Typography>
                  </Alert>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={decrypting || importing}>
          Cancel
        </Button>

        {!decrypted ? (
          <Button
            onClick={handleDecrypt}
            variant="contained"
            color="primary"
            disabled={!selectedFile || !exportPassword || decrypting}
            startIcon={decrypting ? <CircularProgress size={20} /> : undefined}
          >
            {decrypting ? 'Decrypting...' : 'Next'}
          </Button>
        ) : (
          <Button
            onClick={handleImport}
            variant="contained"
            color="primary"
            disabled={importing}
            startIcon={importing ? <CircularProgress size={20} /> : <Upload />}
          >
            Import {credentials.length} Credentials
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
