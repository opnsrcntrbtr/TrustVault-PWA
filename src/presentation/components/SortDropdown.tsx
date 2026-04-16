/**
 * Sort Dropdown Component
 * Sort options for credentials
 */

import { FormControl, Select, MenuItem, InputLabel } from '@mui/material';
import {
  SortByAlpha,
  Update,
  Add,
  Star,
} from '@mui/icons-material';

export type SortOption =
  | 'title-asc'
  | 'title-desc'
  | 'updated-desc'
  | 'created-desc'
  | 'favorites-first';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: Array<{
  value: SortOption;
  label: string;
  icon?: React.ReactElement;
}> = [
  { value: 'title-asc', label: 'Title A-Z', icon: <SortByAlpha fontSize="small" /> },
  { value: 'title-desc', label: 'Title Z-A', icon: <SortByAlpha fontSize="small" /> },
  { value: 'updated-desc', label: 'Recently Updated', icon: <Update fontSize="small" /> },
  { value: 'created-desc', label: 'Recently Created', icon: <Add fontSize="small" /> },
  { value: 'favorites-first', label: 'Favorites First', icon: <Star fontSize="small" /> },
];

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id="sort-select-label">Sort by</InputLabel>
      <Select
        labelId="sort-select-label"
        id="sort-select"
        value={value}
        label="Sort by"
        onChange={(e) => { onChange(e.target.value as SortOption); }}
      >
        {SORT_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {option.icon}
              {option.label}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

// Import Box for layout
import { Box } from '@mui/material';
