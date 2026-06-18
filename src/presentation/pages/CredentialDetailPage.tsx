/**
 * Credential Detail Page
 * Read-only view of a credential with copy actions
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import CredentialDetailsDialog from '@/presentation/components/CredentialDetailsDialog';
import DeleteConfirmDialog from '@/presentation/components/DeleteConfirmDialog';
import type { Credential } from '@/domain/entities/Credential';
import { clipboardManager } from '@/presentation/utils/clipboard';

export default function CredentialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vaultKey, user } = useAuthStore();

  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id || !vaultKey || !user) {
      setError('Invalid credential ID or session expired');
      setLoading(false);
      return;
    }

    const loadCredential = async () => {
      try {
        setLoading(true);
        setError(null);
        const cred = await credentialRepository.findById(id, vaultKey, user.id);
        if (!cred) {
          setError('Credential not found');
        } else {
          setCredential(cred);
        }
      } catch (err) {
        console.error('Failed to load credential:', err);
        setError(err instanceof Error ? err.message : 'Failed to load credential');
      } finally {
        setLoading(false);
      }
    };

    loadCredential();
  }, [id, vaultKey, user]);

  const handleCopyUsername = async () => {
    if (!credential || !user) return;
    await credentialRepository.updateAccessTime(credential.id, user.id);
    const success = await clipboardManager.copy(credential.username, false, 0);
    if (success) {
      // Show feedback in dialog
    }
  };

  const handleCopyPassword = async () => {
    if (!credential || !user) return;
    await credentialRepository.updateAccessTime(credential.id, user.id);
    const success = await clipboardManager.copy(credential.password, true, 30);
    if (success) {
      // Show feedback in dialog
    }
  };

  const handleEdit = () => {
    if (credential) {
      setDialogOpen(false);
      navigate(`/credentials/${credential.id}/edit`);
    }
  };

  const handleDelete = () => {
    setDialogOpen(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!credential || !user || !vaultKey) return;

    setDeleting(true);
    try {
      await credentialRepository.delete(credential.id, vaultKey, user.id);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete credential:', err);
      setError('Failed to delete credential');
      setDeleting(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    navigate('/');
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="fixed">
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => navigate('/')}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Credential Details
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3, mt: 8 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {error && !loading && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
            <Button size="small" onClick={() => navigate('/')} sx={{ ml: 2 }}>
              Back to Dashboard
            </Button>
          </Alert>
        )}

        {!loading && !error && credential && (
          <Card>
            <CardContent>
              <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={handleEdit}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography color="textSecondary" gutterBottom>
                  Title
                </Typography>
                <Typography variant="body1">{credential.title}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography color="textSecondary" gutterBottom>
                  Username
                </Typography>
                <Typography variant="body1">{credential.username}</Typography>
              </Box>

              {credential.password && (
                <Box sx={{ mb: 2 }}>
                  <Typography color="textSecondary" gutterBottom>
                    Password
                  </Typography>
                  <Typography variant="body1">••••••••</Typography>
                </Box>
              )}

              {credential.url && (
                <Box sx={{ mb: 2 }}>
                  <Typography color="textSecondary" gutterBottom>
                    URL
                  </Typography>
                  <Typography variant="body1">{credential.url}</Typography>
                </Box>
              )}

              {credential.category && (
                <Box sx={{ mb: 2 }}>
                  <Typography color="textSecondary" gutterBottom>
                    Category
                  </Typography>
                  <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                    {credential.category}
                  </Typography>
                </Box>
              )}

              {credential.tags.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography color="textSecondary" gutterBottom>
                    Tags
                  </Typography>
                  <Typography variant="body1">{credential.tags.join(', ')}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Box>

      {credential && (
        <>
          <CredentialDetailsDialog
            open={dialogOpen}
            credential={credential}
            onClose={handleDialogClose}
            onCopyUsername={handleCopyUsername}
            onCopyPassword={handleCopyPassword}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleFavorite={async () => {
              if (!vaultKey || !user) return;
              try {
                const newFavoriteState = !credential.isFavorite;
                await credentialRepository.update(
                  credential.id,
                  { isFavorite: newFavoriteState },
                  vaultKey,
                  user.id
                );
                setCredential({
                  ...credential,
                  isFavorite: newFavoriteState,
                });
              } catch (err) {
                console.error('Failed to toggle favorite:', err);
              }
            }}
          />

          <DeleteConfirmDialog
            open={deleteDialogOpen}
            credentialTitle={credential.title}
            onCancel={() => { setDeleteDialogOpen(false); }}
            onConfirm={handleDeleteConfirm}
            loading={deleting}
          />
        </>
      )}
    </Box>
  );
}
