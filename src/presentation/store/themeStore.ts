/**
 * Theme Store (Zustand)
 * Manages light/dark theme preference with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  // State
  mode: ThemeMode;

  // Actions
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Initial state - default to dark mode
      mode: 'dark',

      // Toggle between light and dark
      toggleTheme: () =>
        set((state) => ({
          mode: state.mode === 'light' ? 'dark' : 'light',
        })),

      // Set specific theme
      setTheme: (mode) => set({ mode }),
    }),
    {
      name: 'trustvault-theme', // localStorage key
      version: 1,
    }
  )
);
