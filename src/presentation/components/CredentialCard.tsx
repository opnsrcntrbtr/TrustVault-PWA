/**
 * Credential Card Component
 * Displays a single credential with actions
 */

import { useState, memo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  IconButton,
  Button,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  MoreVert,
  ContentCopy,
  Edit,
  Delete,
  Star,
  StarBorder,
  GppBad,
} from '@mui/icons-material';
import type { Credential } from '@/domain/entities/Credential';
import { clipboardManager } from '@/presentation/utils/clipboard';
import { formatRelativeTime } from '@/presentation/utils/timeFormat';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { getBreachResult } from '@/data/repositories/breachResultsRepository';
import TotpDisplay from './TotpDisplay';
import CategoryIcon, { getCategoryColor, getCategoryName } from './CategoryIcon';
import type { BreachSeverity } from '@/core/breach/breachTypes';

interface CredentialCardProps {
  credential: Credential;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onCopySuccess: (message: string) => void;
  showBreachStatus?: boolean;
}

// Memoize component to prevent unnecessary re-renders
const CredentialCard = memo(function CredentialCard({
  credential,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCopySuccess,
  showBreachStatus = true,
}: CredentialCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [breachStatus, setBreachStatus] = useState<{
    breached: boolean;
    severity: BreachSeverity;
    breachCount?: number;
  } | null>(null);

  useEffect(() => {
    if (showBreachStatus) {
      loadBreachStatus();
    }
  }, [credential.id, showBreachStatus]);

  const loadBreachStatus = async () => {
    try {
      const result = await getBreachResult(credential.id, 'password');
      if (result && result.breached) {
        const status: { breached: boolean; severity: BreachSeverity; breachCount?: number } = {
          breached: true,
          severity: result.severity,
        };
        if (result.breachCount !== undefined) {
          status.breachCount = result.breachCount;
        }
        setBreachStatus(status);
      } else {
        setBreachStatus(null);
      }
    } catch (error) {
      console.error('Failed to load breach status:', error);
    }
  };

  const handleCopyUsername = async () => {
    // Update access time
    await credentialRepository.updateAccessTime(credential.id);
    
    const success = await clipboardManager.copy(credential.username, false, 0);
    if (success) {
      onCopySuccess(`Username copied: ${credential.username}`);
    } else {
      onCopySuccess('Failed to copy username');
    }
  };

  const handleCopyPassword = async () => {
    // Update access time
    await credentialRepository.updateAccessTime(credential.id);
    
    const success = await clipboardManager.copy(credential.password, true, 30);
    if (success) {
      onCopySuccess('Password copied! Auto-clearing in 30 seconds');
    } else {
      onCopySuccess('Failed to copy password');
    }
  };

  const getPasswordStrengthColor = (score?: number) => {
    if (!score) return 'default';
    if (score >= 80) return 'success';
    if (score >= 60) return 'info';
    if (score >= 40) return 'warning';
    return 'error';
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '&:hover': {
          boxShadow: 3,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ mr: 2 }}>
            <CategoryIcon category={credential.category} size="small" />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                {credential.title}
              </Typography>
              <Tooltip title={credential.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                <IconButton
                  size="small"
                  onClick={() => { onToggleFavorite(credential.id); }}
                  sx={{ color: credential.isFavorite ? 'warning.main' : 'action.disabled' }}
                >
                  {credential.isFavorite ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary" noWrap>
              {credential.username}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => { setMenuAnchor(e.currentTarget); }}
            sx={{ ml: 1 }}
          >
            <MoreVert />
          </IconButton>
        </Box>

        {/* URL */}
        {credential.url && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
            noWrap
          >
            {credential.url}
          </Typography>
        )}

        {/* TOTP Display */}
        {credential.totpSecret && (
          <Box sx={{ mb: 2 }}>
            <TotpDisplay totpSecret={credential.totpSecret} />
          </Box>
        )}

        {/* Category and Tags */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          <Chip
            size="small"
            label={getCategoryName(credential.category)}
            sx={{
              backgroundColor: getCategoryColor(credential.category),
              color: 'white',
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          />
          {credential.tags && credential.tags.length > 0 && (
            <>
              {credential.tags.slice(0, 3).map((tag) => (
                <Chip
                  key={tag}
                  size="small"
                  label={tag}
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
              {credential.tags.length > 3 && (
                <Chip
                  size="small"
                  label={`+${credential.tags.length - 3}`}
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </>
          )}
        </Box>

        {/* Metadata */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
          {breachStatus && breachStatus.breached && (
            <Tooltip
              title={`Password found in ${breachStatus.breachCount?.toLocaleString() || 'multiple'} data breach${breachStatus.breachCount === 1 ? '' : 'es'}! Change immediately.`}
            >
              <Chip
                icon={<GppBad />}
                label={`Breached ${breachStatus.breachCount ? `(${breachStatus.breachCount.toLocaleString()}x)` : ''}`}
                size="small"
                color={breachStatus.severity === 'critical' || breachStatus.severity === 'high' ? 'error' : 'warning'}
                sx={{ fontWeight: 600 }}
              />
            </Tooltip>
          )}
          {credential.securityScore !== undefined && (
            <Chip
              label={`Security: ${credential.securityScore}%`}
              size="small"
              color={getPasswordStrengthColor(credential.securityScore)}
              variant="outlined"
            />
          )}
        </Box>

        {/* Tags */}
        {credential.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
            {credential.tags.slice(0, 3).map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="filled" />
            ))}
            {credential.tags.length > 3 && (
              <Chip label={`+${credential.tags.length - 3}`} size="small" variant="filled" />
            )}
          </Box>
        )}

        {/* Last Updated */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Updated {formatRelativeTime(credential.updatedAt)}
        </Typography>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ pt: 0 }}>
        <Button size="small" startIcon={<ContentCopy />} onClick={handleCopyUsername}>
          Username
        </Button>
        <Button size="small" startIcon={<ContentCopy />} onClick={handleCopyPassword}>
          Password
        </Button>
        <Button size="small" startIcon={<Edit />} onClick={() => { onEdit(credential.id); }}>
          Edit
        </Button>
      </CardActions>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => { setMenuAnchor(null); }}
      >
        <MenuItem onClick={() => { onEdit(credential.id); setMenuAnchor(null); }}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onToggleFavorite(credential.id); setMenuAnchor(null); }}>
          <ListItemIcon>
            {credential.isFavorite ? <StarBorder fontSize="small" /> : <Star fontSize="small" />}
          </ListItemIcon>
          <ListItemText>
            {credential.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => { onDelete(credential.id); setMenuAnchor(null); }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
});

export default CredentialCard;
