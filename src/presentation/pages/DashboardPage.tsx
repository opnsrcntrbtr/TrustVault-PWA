/**
 * Dashboard Page Component
 * Main credential management interface
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Card,
  CardContent,
  Button,
  Fab,
  Menu,
  MenuItem,
  Avatar,
  Snackbar,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Menu as MenuIcon,
  Add as AddIcon,
  Lock as LockIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  Favorite as FavoriteIcon,
  Security as SecurityIcon,
  AccessTime,
  Star as StarIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import CredentialCard from '@/presentation/components/CredentialCard';
import SwipeableCredentialCard from '@/presentation/components/SwipeableCredentialCard';
import CredentialDetailsDialog from '@/presentation/components/CredentialDetailsDialog';
import CredentialSection from '@/presentation/components/CredentialSection';
import DeleteConfirmDialog from '@/presentation/components/DeleteConfirmDialog';
import SearchBar from '@/presentation/components/SearchBar';
import FilterChips from '@/presentation/components/FilterChips';
import SortDropdown, { type SortOption } from '@/presentation/components/SortDropdown';
import ThemeToggle from '@/presentation/components/ThemeToggle';
import TourHelpButton from '@/components/TourHelpButton';
import type { Credential, CredentialCategory } from '@/domain/entities/Credential';
import { clipboardManager } from '@/presentation/utils/clipboard';
import BreachAlertBanner from '@/presentation/components/BreachAlertBanner';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, vaultKey } = useAuthStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // UI state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Mobile details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);

  // Filter and sort state
  const [selectedCategory, setSelectedCategory] = useState<CredentialCategory | 'all'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');

  // Credentials state
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load credentials function
  const loadCredentials = useCallback(async () => {
    if (!vaultKey) {
      setError('No vault key available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const creds = await credentialRepository.findAll(vaultKey);
      setCredentials(creds);
    } catch (err) {
      console.error('Failed to load credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, [vaultKey]);

  // Load credentials on mount and when vaultKey changes
  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleLockVault = useCallback(() => {
    // Lock the vault (clears vault key, keeps user authenticated)
    useAuthStore.getState().lockVault();
    showSnackbar('Vault locked successfully');
  }, [showSnackbar]);

  const handleEdit = useCallback((id: string) => {
    navigate(`/credentials/${id}/edit`);
  }, [navigate]);

  const handleDeleteRequest = useCallback((id: string) => {
    setCredentialToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!credentialToDelete) return;

    setDeleting(true);
    try {
      await credentialRepository.delete(credentialToDelete);
      setCredentials((prev) => prev.filter((c) => c.id !== credentialToDelete));
      showSnackbar('Credential deleted successfully');
      setDeleteDialogOpen(false);
      setCredentialToDelete(null);
    } catch (err) {
      console.error('Failed to delete credential:', err);
      showSnackbar('Failed to delete credential');
    } finally {
      setDeleting(false);
    }
  }, [credentialToDelete, showSnackbar]);

  const handleToggleFavorite = async (id: string) => {
    if (!vaultKey) return;

    try {
      const credential = credentials.find((c) => c.id === id);
      if (!credential) return;

      const newFavoriteState = !credential.isFavorite;

      await credentialRepository.update(
        id,
        { isFavorite: newFavoriteState },
        vaultKey
      );

      // Update local state
      setCredentials((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isFavorite: newFavoriteState } : c))
      );

      showSnackbar(newFavoriteState ? 'Added to favorites' : 'Removed from favorites');
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      showSnackbar('Failed to update favorite');
    }
  };

  const getCredentialToDelete = () => {
    return credentials.find((c) => c.id === credentialToDelete);
  };

  // Mobile-specific handlers
  const handleCredentialTap = (id: string) => {
    if (isMobile) {
      const credential = credentials.find((c) => c.id === id);
      if (credential) {
        setSelectedCredential(credential);
        setDetailsDialogOpen(true);
      }
    }
  };

  const handleCopyUsername = async () => {
    if (!selectedCredential) return;
    await credentialRepository.updateAccessTime(selectedCredential.id);
    const success = await clipboardManager.copy(selectedCredential.username, false, 0);
    if (success) {
      showSnackbar(`Username copied: ${selectedCredential.username}`);
    } else {
      showSnackbar('Failed to copy username');
    }
  };

  const handleCopyPassword = async () => {
    if (!selectedCredential) return;
    await credentialRepository.updateAccessTime(selectedCredential.id);
    const success = await clipboardManager.copy(selectedCredential.password, true, 30);
    if (success) {
      showSnackbar('Password copied! Auto-clearing in 30 seconds');
    } else {
      showSnackbar('Failed to copy password');
    }
  };

  const handleDetailsEdit = () => {
    if (selectedCredential) {
      setDetailsDialogOpen(false);
      handleEdit(selectedCredential.id);
    }
  };

  const handleDetailsDelete = () => {
    if (selectedCredential) {
      setDetailsDialogOpen(false);
      handleDeleteRequest(selectedCredential.id);
    }
  };

  const handleDetailsToggleFavorite = () => {
    if (selectedCredential) {
      handleToggleFavorite(selectedCredential.id);
      // Update selected credential
      setSelectedCredential({
        ...selectedCredential,
        isFavorite: !selectedCredential.isFavorite,
      });
    }
  };

  // Filter and sort credentials with useMemo for performance
  const filteredAndSortedCredentials = useMemo(() => {
    let filtered = [...credentials];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (credential) =>
          credential.title.toLowerCase().includes(query) ||
          credential.username.toLowerCase().includes(query) ||
          credential.url?.toLowerCase().includes(query) ||
          credential.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((credential) => credential.category === selectedCategory);
    }

    // Apply favorites filter
    if (favoritesOnly) {
      filtered = filtered.filter((credential) => credential.isFavorite);
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((credential) =>
        selectedTags.every((tag) => credential.tags.includes(tag))
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'title-asc':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'updated-desc':
        filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        break;
      case 'created-desc':
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'favorites-first':
        filtered.sort((a, b) => {
          if (a.isFavorite === b.isFavorite) {
            return b.updatedAt.getTime() - a.updatedAt.getTime();
          }
          return a.isFavorite ? -1 : 1;
        });
        break;
    }

    return filtered;
  }, [credentials, searchQuery, selectedCategory, favoritesOnly, selectedTags, sortBy]);

  // Separate credentials into sections
  const favoriteCredentials = useMemo(() => {
    return credentials
      .filter((c) => c.isFavorite)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 6); // Show max 6 favorites
  }, [credentials]);

  const recentlyUsedCredentials = useMemo(() => {
    return credentials
      .filter((c) => c.lastAccessedAt)
      .sort((a, b) => {
        const timeA = a.lastAccessedAt?.getTime() || 0;
        const timeB = b.lastAccessedAt?.getTime() || 0;
        return timeB - timeA;
      })
      .slice(0, 6); // Show max 6 recently used
  }, [credentials]);

  // Get all unique tags from credentials
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    credentials.forEach((credential) => {
      credential.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [credentials]);

  // Calculate stats
  const totalCredentials = credentials.length;
  const strongPasswords = credentials.filter((c) => (c.securityScore || 0) >= 80).length;
  const weakPasswords = credentials.filter((c) => (c.securityScore || 0) < 60).length;
  const averageScore = totalCredentials > 0
    ? Math.round(credentials.reduce((sum, c) => sum + (c.securityScore || 0), 0) / totalCredentials)
    : 0;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => { setDrawerOpen(!drawerOpen); }}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }} data-tour="dashboard">
            TrustVault
          </Typography>
          <TourHelpButton />
          <ThemeToggle />
          <IconButton color="inherit" onClick={handleLockVault}>
            <LockIcon />
          </IconButton>
          <IconButton color="inherit" onClick={(e) => { setMenuAnchor(e.currentTarget); }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => { setMenuAnchor(null); }}
          >
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                navigate('/settings');
              }}
            >
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              Settings
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); }}
        sx={{
          width: 240,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            <ListItemButton selected>
              <ListItemIcon>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText primary="All Credentials" />
            </ListItemButton>
            <ListItemButton onClick={() => navigate('/favorites')}>
              <ListItemIcon>
                <FavoriteIcon />
              </ListItemIcon>
              <ListItemText primary="Favorites" />
            </ListItemButton>
            <ListItemButton onClick={() => navigate('/password-generator')}>
              <ListItemIcon>
                <VpnKeyIcon />
              </ListItemIcon>
              <ListItemText primary="Password Generator" />
            </ListItemButton>
            <ListItemButton onClick={() => navigate('/security-audit')} data-tour="security-audit">
              <ListItemIcon>
                <SecurityIcon />
              </ListItemIcon>
              <ListItemText primary="Security Audit" />
            </ListItemButton>
            <ListItemButton onClick={() => navigate('/settings')} data-tour="settings">
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          bgcolor: 'background.default',
        }}
      >
        {/* Breach Alert Banner */}
        <BreachAlertBanner />

        {/* Search Bar */}
        <Box sx={{ mb: 3 }} data-tour="search">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search credentials..."
            debounceMs={300}
          />
        </Box>

        {/* Filter Chips */}
        <Box sx={{ mb: 3 }}>
          <FilterChips
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            favoritesOnly={favoritesOnly}
            onFavoritesToggle={() => { setFavoritesOnly(!favoritesOnly); }}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            availableTags={allTags}
          />
        </Box>

        {/* Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Credentials
                </Typography>
                <Typography variant="h4">{totalCredentials}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Strong Passwords
                </Typography>
                <Typography variant="h4" color="success.main">
                  {strongPasswords}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Weak Passwords
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {weakPasswords}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Security Score
                </Typography>
                <Typography variant="h4" color={averageScore >= 70 ? 'success.main' : 'warning.main'}>
                  {averageScore}/100
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Credentials List Header with Sort */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h5">
            {searchQuery || selectedCategory !== 'all' || favoritesOnly
              ? `Found ${filteredAndSortedCredentials.length} credential${
                  filteredAndSortedCredentials.length !== 1 ? 's' : ''
                }`
              : 'Your Credentials'}
          </Typography>
          <SortDropdown value={sortBy} onChange={setSortBy} />
        </Box>

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error State */}
        {error && !loading && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
            <Button size="small" onClick={loadCredentials} sx={{ ml: 2 }}>
              Retry
            </Button>
          </Alert>
        )}

        {/* Empty State */}
        {!loading && !error && credentials.length === 0 && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <LockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No credentials yet
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Start securing your passwords by adding your first credential
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/credentials/add')}
                data-tour="add-credential"
              >
                Add Credential
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Search Results */}
        {!loading && !error && credentials.length > 0 && filteredAndSortedCredentials.length === 0 && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" gutterBottom>
                No credentials found
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Try adjusting your search or filters
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setFavoritesOnly(false);
                  setSelectedTags([]);
                }}
              >
                Clear All Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Favorites Section - Show when no filters active */}
        {!loading && !error && credentials.length > 0 && favoriteCredentials.length > 0 && 
         !searchQuery && selectedCategory === 'all' && !favoritesOnly && selectedTags.length === 0 && (
          <Box sx={{ mb: 4 }}>
            <CredentialSection
              title="Favorites"
              subtitle="Your starred credentials"
              icon={<StarIcon />}
              credentials={favoriteCredentials}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onToggleFavorite={handleToggleFavorite}
              onCopySuccess={showSnackbar}
            />
          </Box>
        )}

        {/* Recently Used Section - Show when no filters active */}
        {!loading && !error && credentials.length > 0 && recentlyUsedCredentials.length > 0 && 
         !searchQuery && selectedCategory === 'all' && !favoritesOnly && selectedTags.length === 0 && (
          <Box sx={{ mb: 4 }}>
            <CredentialSection
              title="Recently Used"
              subtitle="Your most recently accessed credentials"
              icon={<AccessTime />}
              credentials={recentlyUsedCredentials}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onToggleFavorite={handleToggleFavorite}
              onCopySuccess={showSnackbar}
            />
          </Box>
        )}

        {/* Credentials Grid - Desktop & Tablet */}
        {!loading && !error && filteredAndSortedCredentials.length > 0 && !isMobile && (
          <Grid container spacing={2}>
            {filteredAndSortedCredentials.map((credential) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={credential.id}>
                <CredentialCard
                  credential={credential}
                  onEdit={handleEdit}
                  onDelete={handleDeleteRequest}
                  onToggleFavorite={handleToggleFavorite}
                  onCopySuccess={showSnackbar}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Credentials List - Mobile with Swipe */}
        {!loading && !error && filteredAndSortedCredentials.length > 0 && isMobile && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredAndSortedCredentials.map((credential) => (
              <SwipeableCredentialCard
                key={credential.id}
                credential={credential}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
                onToggleFavorite={handleToggleFavorite}
                onTap={handleCredentialTap}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* FAB - Position adjusted for mobile */}
      <Fab
        color="primary"
        aria-label="add"
        onClick={() => navigate('/credentials/add')}
        data-tour="add-credential"
        sx={{
          position: 'fixed',
          bottom: { xs: 80, md: 24 }, // Higher on mobile to avoid bottom nav
          right: 24,
        }}
      >
        <AddIcon />
      </Fab>

      {/* Mobile Credential Details Dialog */}
      <CredentialDetailsDialog
        open={detailsDialogOpen}
        credential={selectedCredential}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedCredential(null);
        }}
        onCopyUsername={handleCopyUsername}
        onCopyPassword={handleCopyPassword}
        onEdit={handleDetailsEdit}
        onDelete={handleDetailsDelete}
        onToggleFavorite={handleDetailsToggleFavorite}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        credentialTitle={getCredentialToDelete()?.title || 'this credential'}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setCredentialToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => { setSnackbarOpen(false); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => { setSnackbarOpen(false); }}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
