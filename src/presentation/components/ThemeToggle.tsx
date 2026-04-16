/**
 * ThemeToggle Component
 * Icon button to toggle between light and dark mode
 */

import { IconButton, Tooltip } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { useThemeStore } from '../store/themeStore';

export default function ThemeToggle() {
  const { mode, toggleTheme } = useThemeStore();

  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        color="inherit"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        sx={{
          transition: 'transform 0.3s',
          '&:hover': {
            transform: 'rotate(180deg)',
          },
        }}
      >
        {isDark ? <Brightness7 /> : <Brightness4 />}
      </IconButton>
    </Tooltip>
  );
}
