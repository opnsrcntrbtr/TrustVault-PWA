/**
 * Filter Chips Component
 * Category and favorite filters with chips UI
 */

import { Box, Chip, Autocomplete, TextField } from '@mui/material';
import {
  Star as StarIcon,
  Lock,
  CreditCard,
  AccountBalance,
  Person,
  Code,
  Key,
  Note,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import type { CredentialCategory } from '@/domain/entities/Credential';

interface FilterChipsProps {
  selectedCategory: CredentialCategory | 'all';
  onCategoryChange: (category: CredentialCategory | 'all') => void;
  favoritesOnly: boolean;
  onFavoritesToggle: () => void;
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  availableTags?: string[];
}

const CATEGORY_OPTIONS: Array<{
  value: CredentialCategory | 'all';
  label: string;
  icon?: React.ReactElement | undefined;
}> = [
  { value: 'all', label: 'All' },
  { value: 'login', label: 'Login', icon: <Lock fontSize="small" /> },
  { value: 'credit_card', label: 'Cards', icon: <CreditCard fontSize="small" /> },
  { value: 'bank_account', label: 'Bank', icon: <AccountBalance fontSize="small" /> },
  { value: 'identity', label: 'Identity', icon: <Person fontSize="small" /> },
  { value: 'api_key', label: 'API Keys', icon: <Code fontSize="small" /> },
  { value: 'ssh_key', label: 'SSH Keys', icon: <Key fontSize="small" /> },
  { value: 'secure_note', label: 'Notes', icon: <Note fontSize="small" /> },
];

export default function FilterChips({
  selectedCategory,
  onCategoryChange,
  favoritesOnly,
  onFavoritesToggle,
  selectedTags = [],
  onTagsChange,
  availableTags = [],
}: FilterChipsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Category and Favorites Filters */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {CATEGORY_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            {...(option.icon && { icon: option.icon })}
            onClick={() => { onCategoryChange(option.value); }}
            color={selectedCategory === option.value ? 'primary' : 'default'}
            variant={selectedCategory === option.value ? 'filled' : 'outlined'}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                backgroundColor:
                  selectedCategory === option.value
                    ? 'primary.dark'
                    : 'action.hover',
              },
            }}
          />
        ))}

        {/* Favorites Filter */}
        <Chip
          label="Favorites"
          icon={<StarIcon fontSize="small" />}
          onClick={onFavoritesToggle}
          color={favoritesOnly ? 'warning' : 'default'}
          variant={favoritesOnly ? 'filled' : 'outlined'}
          sx={{
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: favoritesOnly ? 'warning.dark' : 'action.hover',
            },
          }}
        />
      </Box>

      {/* Tag Filter */}
      {onTagsChange && availableTags.length > 0 && (
        <Autocomplete
          multiple
          size="small"
          options={availableTags}
          value={selectedTags}
          onChange={(_, newValue) => { onTagsChange(newValue); }}
          renderInput={(params) => (
            <TextField 
              {...params} 
              placeholder="Filter by tags..." 
              size="small"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              InputLabelProps={{ ...(params.InputLabelProps as any) }}
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={option}
                label={option}
                size="small"
                icon={<TagIcon fontSize="small" />}
                color="secondary"
              />
            ))
          }
          sx={{ minWidth: 250 }}
        />
      )}
    </Box>
  );
}
