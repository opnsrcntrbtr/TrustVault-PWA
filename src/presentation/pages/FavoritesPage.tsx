/**
 * Favorites Page
 * Shows only favorite/starred credentials for quick access
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Alert,
  AlertTitle,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  Search,
  Star,
  ContentCopy,
  Edit,
  Visibility,
  VisibilityOff,
  OpenInNew,
} from '@mui/icons-material';
import { Credential } from '@/domain/entities/Credential';
import { useAuthStore } from '../store/authStore';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { copyToClipboard } from '../utils/clipboard';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const { vaultKey } = useAuthStore();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Load favorite credentials function
  const loadFavorites = useCallback(async () => {
    if (!vaultKey) {
      setError('No vault key available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const allCredentials = await credentialRepository.findAll(vaultKey);

      // Filter only favorites
      const favorites = allCredentials.filter((cred) => cred.isFavorite);

      // Sort by recently updated first
      favorites.sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });

      setCredentials(favorites);
      setFilteredCredentials(favorites);
    } catch (err) {
      console.error('Failed to load favorites:', err);
      setError('Failed to load favorite credentials');
    } finally {
      setLoading(false);
    }
  }, [vaultKey]);

  // Load favorite credentials on mount and when vaultKey changes
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Filter credentials based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCredentials(credentials);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = credentials.filter(
      (cred) =>
        cred.title.toLowerCase().includes(query) ||
        cred.username?.toLowerCase().includes(query) ||
        cred.url?.toLowerCase().includes(query) ||
        cred.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
    setFilteredCredentials(filtered);
  }, [searchQuery, credentials]);

  const handleCopyUsername = async (credential: Credential) => {
    if (!credential.username) return;
    await copyToClipboard(credential.username, 0); // No auto-clear for usernames
    showSnackbar(`Username copied: ${credential.username}`);
  };

  const handleCopyPassword = async (credential: Credential) => {
    if (!credential.password) return;
    await copyToClipboard(credential.password, 30000); // 30 seconds in milliseconds
    showSnackbar('Password copied to clipboard (will clear in 30s)');
  };

  const togglePasswordVisibility = (credentialId: string) => {
    setVisiblePasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(credentialId)) {
        newSet.delete(credentialId);
      } else {
        newSet.add(credentialId);
      }
      return newSet;
    });
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setTimeout(() => { setSnackbarMessage(''); }, 3000);
  };

  const handleOpenWebsite = (website: string) => {
    if (!website) return;

    // Ensure URL has protocol
    let url = website;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Login':
        return 'primary';
      case 'Payment':
        return 'success';
      case 'Identity':
        return 'info';
      case 'Note':
        return 'warning';
      case 'Secure Note':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 4 }}>
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')}>
            <ArrowBack />
          </IconButton>
          <Star sx={{ ml: 2, mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Favorites
          </Typography>
          <Chip
            label={`${filteredCredentials.length} items`}
            size="small"
            sx={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 3 }}>
        {/* Search Bar */}
        <TextField
          fullWidth
          placeholder="Search favorites..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); }}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        )}

        {/* Empty State */}
        {!loading && !error && credentials.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Star sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h5" gutterBottom color="text.secondary">
              No Favorites Yet
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Star your most important credentials for quick access.
            </Typography>
            <Button variant="contained" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </Box>
        )}

        {/* No Search Results */}
        {!loading && !error && credentials.length > 0 && filteredCredentials.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Search sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" gutterBottom color="text.secondary">
              No favorites match "{searchQuery}"
            </Typography>
            <Button variant="outlined" onClick={() => { setSearchQuery(''); }}>
              Clear Search
            </Button>
          </Box>
        )}

        {/* Credentials Grid */}
        {!loading && !error && filteredCredentials.length > 0 && (
          <Grid container spacing={2}>
            {filteredCredentials.map((credential) => (
              <Grid item xs={12} sm={6} md={4} key={credential.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" sx={{ mb: 0.5, wordBreak: 'break-word' }}>
                          {credential.title}
                        </Typography>
                        <Chip
                          label={credential.category}
                          size="small"
                          color={getCategoryColor(credential.category) as any}
                          sx={{ mb: 1 }}
                        />
                      </Box>
                      <Tooltip title="Favorite">
                        <Star sx={{ color: 'warning.main', ml: 1 }} />
                      </Tooltip>
                    </Box>

                    {/* Username */}
                    {credential.username && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Username
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                            {credential.username}
                          </Typography>
                          <Tooltip title="Copy username">
                            <IconButton
                              size="small"
                              onClick={() => handleCopyUsername(credential)}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    )}

                    {/* Password */}
                    {credential.password && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Password
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              flexGrow: 1,
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                            }}
                          >
                            {visiblePasswords.has(credential.id)
                              ? credential.password
                              : '••••••••••••'}
                          </Typography>
                          <Tooltip title={visiblePasswords.has(credential.id) ? 'Hide' : 'Show'}>
                            <IconButton
                              size="small"
                              onClick={() => { togglePasswordVisibility(credential.id); }}
                            >
                              {visiblePasswords.has(credential.id) ? (
                                <VisibilityOff fontSize="small" />
                              ) : (
                                <Visibility fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Copy password">
                            <IconButton
                              size="small"
                              onClick={() => handleCopyPassword(credential)}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    )}

                    {/* Website */}
                    {credential.url && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Website
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              flexGrow: 1,
                              wordBreak: 'break-all',
                              color: 'primary.main',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                            onClick={() => { handleOpenWebsite(credential.url!); }}
                          >
                            {credential.url}
                          </Typography>
                          <Tooltip title="Open website">
                            <IconButton
                              size="small"
                              onClick={() => { handleOpenWebsite(credential.url!); }}
                            >
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    )}

                    {/* Tags */}
                    {credential.tags && credential.tags.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
                        {credential.tags.map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </CardContent>

                  {/* Actions */}
                  <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                    <Button
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => navigate(`/credentials/${credential.id}/edit`)}
                    >
                      Edit
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Snackbar */}
        {snackbarMessage && (
          <Alert
            severity="success"
            sx={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1400,
              minWidth: 300,
            }}
            onClose={() => { setSnackbarMessage(''); }}
          >
            {snackbarMessage}
          </Alert>
        )}
      </Container>
    </Box>
  );
}
