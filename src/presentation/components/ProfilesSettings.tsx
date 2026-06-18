/**
 * Profiles Settings (Phase 7 — multi-vault profiles): create, rename, set
 * default, and delete vault profiles. Deleting a profile deletes its
 * credentials too (ProfileRepositoryImpl.delete) — confirmed via dialog.
 */
import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  MenuItem,
} from '@mui/material';
import { Add, Edit, Delete, Star, StarBorder } from '@mui/icons-material';
import { useAuthStore } from '@/presentation/store/authStore';
import { useProfileStore } from '@/presentation/store/profileStore';
import { profileRepository } from '@/data/repositories/ProfileRepositoryImpl';
import type { VaultProfile, VaultProfileType } from '@/domain/entities/VaultProfile';

const TYPE_OPTIONS: { value: VaultProfileType; label: string }[] = [
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
  { value: 'shared_family', label: 'Shared / Family' },
  { value: 'custom', label: 'Custom' },
];

export default function ProfilesSettings() {
  const { user, vaultKey } = useAuthStore();
  const { profiles, addProfile, updateProfile, removeProfile, setActiveProfile, activeProfileId } =
    useProfileStore();

  const [editing, setEditing] = useState<VaultProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<VaultProfileType>('custom');
  const [deleteTarget, setDeleteTarget] = useState<VaultProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setName('');
    setType('custom');
    setIsCreating(true);
    setError(null);
  };

  const openEdit = (profile: VaultProfile) => {
    setEditing(profile);
    setName(profile.name);
    setType(profile.type);
    setError(null);
  };

  const closeDialog = () => {
    setIsCreating(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!vaultKey || !user || !name.trim()) return;
    try {
      if (editing) {
        const updated = await profileRepository.update(
          editing.id,
          { name: name.trim(), type },
          vaultKey,
          user.id
        );
        updateProfile(updated);
      } else {
        const created = await profileRepository.create(
          { name: name.trim(), type },
          vaultKey,
          user.id
        );
        addProfile(created);
      }
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    }
  };

  const handleSetDefault = async (profile: VaultProfile) => {
    if (!user) return;
    await profileRepository.setDefault(profile.id, user.id);
    profiles.forEach((p) => {
      updateProfile({ ...p, isDefault: p.id === profile.id });
    });
  };

  const handleDelete = async () => {
    if (!vaultKey || !user || !deleteTarget) return;
    const wasActive = deleteTarget.id === activeProfileId;
    try {
      await profileRepository.delete(deleteTarget.id, vaultKey, user.id);
      removeProfile(deleteTarget.id);
      if (wasActive) {
        const remaining = await profileRepository.findAll(vaultKey, user.id);
        const next = remaining.find((p) => p.isDefault) ?? remaining[0];
        if (next) {
          addProfile(next);
          setActiveProfile(next.id);
        }
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
      setDeleteTarget(null);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Vault Profiles</Typography>
        <Button startIcon={<Add />} onClick={openCreate} size="small">
          New Profile
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Separate credentials into Personal, Work, or other profiles.
      </Typography>

      <List dense>
        {profiles.map((profile) => (
          <ListItem
            key={profile.id}
            secondaryAction={
              <>
                <IconButton
                  edge="end"
                  aria-label={`set ${profile.name} as default`}
                  onClick={() => { void handleSetDefault(profile); }}
                  size="small"
                >
                  {profile.isDefault ? <Star color="warning" /> : <StarBorder />}
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label={`edit ${profile.name}`}
                  onClick={() => { openEdit(profile); }}
                  size="small"
                >
                  <Edit />
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label={`delete ${profile.name}`}
                  onClick={() => { setDeleteTarget(profile); }}
                  size="small"
                >
                  <Delete />
                </IconButton>
              </>
            }
          >
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {profile.name}
                  {profile.id === activeProfileId && <Chip label="Active" size="small" color="primary" />}
                </Box>
              }
              secondary={profile.type}
            />
          </ListItem>
        ))}
      </List>

      <Dialog open={isCreating || !!editing} onClose={closeDialog}>
        <DialogTitle>{editing ? 'Rename Profile' : 'New Profile'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            autoFocus
            fullWidth
            label="Name"
            value={name}
            onChange={(e) => { setName(e.target.value); }}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            select
            fullWidth
            label="Type"
            value={type}
            onChange={(e) => { setType(e.target.value as VaultProfileType); }}
          >
            {TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={() => { void handleSave(); }} variant="contained" disabled={!name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => { setDeleteTarget(null); }}>
        <DialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            This permanently deletes this profile and all credentials inside it. This cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteTarget(null); }}>Cancel</Button>
          <Button onClick={() => { void handleDelete(); }} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
