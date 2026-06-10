/**
 * Theme Store Tests (Phase 3 — display settings)
 * Validates toggle/set behavior and localStorage persistence key.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/presentation/store/themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ mode: 'dark' });
  });

  it('defaults to dark mode', () => {
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('toggleTheme flips dark → light → dark', () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().mode).toBe('light');

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('setTheme sets an explicit mode', () => {
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().mode).toBe('light');

    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('persists the mode under the trustvault-theme localStorage key', () => {
    useThemeStore.getState().setTheme('light');

    const raw = localStorage.getItem('trustvault-theme');
    expect(raw).toBeTruthy();

    const persisted = JSON.parse(raw as string) as { state: { mode: string } };
    expect(persisted.state.mode).toBe('light');
  });
});
