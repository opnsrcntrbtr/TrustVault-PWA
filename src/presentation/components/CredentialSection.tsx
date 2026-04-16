/**
 * Credential Section Component
 * Groups credentials with a header (e.g., Favorites, Recently Used, All Credentials)
 */

import { Box, Typography, Divider } from '@mui/material';
import Grid from '@mui/material/Grid2';
import type { Credential } from '@/domain/entities/Credential';
import CredentialCard from './CredentialCard';

interface CredentialSectionProps {
  title: string;
  subtitle?: string;
  credentials: Credential[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onCopySuccess: (message: string) => void;
  emptyMessage?: string;
  icon?: React.ReactNode;
}

export default function CredentialSection({
  title,
  subtitle,
  credentials,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCopySuccess,
  emptyMessage,
  icon,
}: CredentialSectionProps) {
  if (credentials.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 4 }}>
      {/* Section Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {icon}
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Credentials Grid */}
      <Grid container spacing={2}>
        {credentials.map((credential) => (
          <Grid key={credential.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <CredentialCard
              credential={credential}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onCopySuccess={onCopySuccess}
            />
          </Grid>
        ))}
      </Grid>

      {credentials.length === 0 && emptyMessage && (
        <Box
          sx={{
            textAlign: 'center',
            py: 4,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">{emptyMessage}</Typography>
        </Box>
      )}
    </Box>
  );
}
