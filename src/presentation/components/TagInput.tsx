/**
 * Tag Input Component
 * Input field with autocomplete for credential tags
 */

import { useState } from 'react';
import {
  Box,
  TextField,
  Chip,
  Autocomplete,
} from '@mui/material';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  disabled?: boolean;
}

export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = (newTag: string) => {
    const trimmedTag = newTag.trim().toLowerCase();

    // Validate tag
    if (!trimmedTag) return;
    if (tags.includes(trimmedTag)) return;
    if (trimmedTag.length > 50) return;

    // Add tag
    onChange([...tags, trimmedTag]);
    setInputValue('');
  };

  const handleDeleteTag = (tagToDelete: string) => {
    onChange(tags.filter((tag) => tag !== tagToDelete));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && inputValue) {
      event.preventDefault();
      handleAddTag(inputValue);
    }
  };

  return (
    <Box>
      <Autocomplete
        freeSolo
        options={suggestions.filter((s) => !tags.includes(s))}
        inputValue={inputValue}
        onInputChange={(_, value) => { setInputValue(value); }}
        onChange={(_, value) => {
          if (typeof value === 'string') {
            handleAddTag(value);
          }
        }}
        disabled={disabled}
        renderInput={(params) => {
          // TypeScript workaround for exactOptionalPropertyTypes with MUI Autocomplete params
          // The params.size property can be undefined which conflicts with strict typing
          const textFieldParams = params as any;
          return (
            <TextField
              {...textFieldParams}
              label="Tags"
              placeholder={tags.length === 0 ? 'Add tags (press Enter)' : 'Add more tags'}
              helperText="Press Enter or select from suggestions"
              onKeyDown={handleKeyDown}
            />
          );
        }}
      />

      {/* Tag Chips */}
      {tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              {...(!disabled && { onDelete: () => { handleDeleteTag(tag); } })}
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
