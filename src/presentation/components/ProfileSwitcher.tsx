/**
 * ProfileSwitcher (Phase 7 — multi-vault profiles): app-bar dropdown to view
 * and switch the active vault profile. Switching only updates profileStore's
 * activeProfileId — pages that read it (DashboardPage, FavoritesPage,
 * AddCredentialPage) re-fetch automatically via their existing useEffect deps.
 */
import { useState } from 'react';
import { Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, Chip } from '@mui/material';
import { Workspaces, Check } from '@mui/icons-material';
import { useProfileStore } from '@/presentation/store/profileStore';

export default function ProfileSwitcher() {
  const { profiles, activeProfileId, setActiveProfile } = useProfileStore();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (profiles.length <= 1) return null;

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <>
      <Tooltip title="Switch vault profile">
        <Chip
          icon={<Workspaces />}
          label={activeProfile?.name ?? 'Profile'}
          onClick={(e) => { setAnchorEl(e.currentTarget); }}
          color="default"
          variant="outlined"
          sx={{ mr: 1, color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
        />
      </Tooltip>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => { setAnchorEl(null); }}>
        {profiles.map((profile) => (
          <MenuItem
            key={profile.id}
            selected={profile.id === activeProfileId}
            onClick={() => {
              setActiveProfile(profile.id);
              setAnchorEl(null);
            }}
          >
            {profile.id === activeProfileId && (
              <ListItemIcon>
                <Check fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText inset={profile.id !== activeProfileId}>{profile.name}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
