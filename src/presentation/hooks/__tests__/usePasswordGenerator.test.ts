/**
 * Password Generator Hook Tests
 * Phase 2.1 validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePasswordGenerator } from '../usePasswordGenerator';

describe('usePasswordGenerator', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with default options', () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      expect(result.current.options).toEqual({
        length: 20,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        excludeAmbiguous: false,
      });
    });

    it('should generate initial password on mount', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      await waitFor(() => {
        expect(result.current.password).toBeTruthy();
        expect(result.current.password.length).toBe(20);
      });
    });

    it('should calculate initial strength', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      await waitFor(() => {
        expect(result.current.strength).toBeTruthy();
        expect(result.current.strength?.score).toBeGreaterThan(0);
      });
    });
  });

  describe('Password Generation', () => {
    it('should generate password with correct length', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.setLength(16);
      });
      
      await waitFor(() => {
        expect(result.current.password.length).toBe(16);
      });
    });

    it('should generate different passwords on each call', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      await waitFor(() => {
        expect(result.current.password).toBeTruthy();
      });
      
      const firstPassword = result.current.password;
      
      act(() => {
        result.current.generatePassword();
      });
      
      await waitFor(() => {
        expect(result.current.password).not.toBe(firstPassword);
      });
    });

    it('should include uppercase when enabled', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.updateOptions({
          uppercase: true,
          lowercase: false,
          numbers: false,
          symbols: false,
          length: 30,
        });
      });
      
      await waitFor(() => {
        expect(/[A-Z]/.test(result.current.password)).toBe(true);
        expect(/[a-z]/.test(result.current.password)).toBe(false);
      });
    });

    it('should include lowercase when enabled', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.updateOptions({
          uppercase: false,
          lowercase: true,
          numbers: false,
          symbols: false,
          length: 30,
        });
      });
      
      await waitFor(() => {
        expect(/[a-z]/.test(result.current.password)).toBe(true);
        expect(/[A-Z]/.test(result.current.password)).toBe(false);
      });
    });

    it('should include numbers when enabled', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.updateOptions({
          uppercase: false,
          lowercase: false,
          numbers: true,
          symbols: false,
          length: 30,
        });
      });
      
      await waitFor(() => {
        expect(/[0-9]/.test(result.current.password)).toBe(true);
      });
    });

    it('should include symbols when enabled', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.updateOptions({
          uppercase: false,
          lowercase: false,
          numbers: false,
          symbols: true,
          length: 30,
        });
      });
      
      await waitFor(() => {
        expect(/[!@#$%^&*()_+\-=[\]{};:,.<>?]/.test(result.current.password)).toBe(true);
      });
    });

    it('should exclude ambiguous characters when requested', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.updateOptions({
          excludeAmbiguous: true,
          length: 100,
        });
      });
      
      await waitFor(() => {
        // Should not contain: i, l, o, 0, 1, I, O, |
        expect(/[il0O|]/.test(result.current.password)).toBe(false);
      });
    });
  });

  describe('Option Updates', () => {
    it('should update length', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.setLength(24);
      });
      
      expect(result.current.options.length).toBe(24);
      await waitFor(() => {
        expect(result.current.password.length).toBe(24);
      });
    });

    it('should toggle uppercase', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      const initialValue = result.current.options.uppercase;
      
      act(() => {
        result.current.toggleUppercase();
      });
      
      expect(result.current.options.uppercase).toBe(!initialValue);
    });

    it('should toggle lowercase', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      const initialValue = result.current.options.lowercase;
      
      act(() => {
        result.current.toggleLowercase();
      });
      
      expect(result.current.options.lowercase).toBe(!initialValue);
    });

    it('should toggle numbers', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      const initialValue = result.current.options.numbers;
      
      act(() => {
        result.current.toggleNumbers();
      });
      
      expect(result.current.options.numbers).toBe(!initialValue);
    });

    it('should toggle symbols', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      const initialValue = result.current.options.symbols;
      
      act(() => {
        result.current.toggleSymbols();
      });
      
      expect(result.current.options.symbols).toBe(!initialValue);
    });

    it('should toggle exclude ambiguous', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      const initialValue = result.current.options.excludeAmbiguous;
      
      act(() => {
        result.current.toggleExcludeAmbiguous();
      });
      
      expect(result.current.options.excludeAmbiguous).toBe(!initialValue);
    });
  });

  describe('Strength Calculation', () => {
    it('should calculate strength for generated password', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      await waitFor(() => {
        expect(result.current.strength).toBeTruthy();
        expect(result.current.strength?.score).toBeGreaterThan(0);
        expect(result.current.strength?.strength).toBeDefined();
      });
    });

    it('should update strength when password changes', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      await waitFor(() => {
        expect(result.current.strength).toBeTruthy();
      });
      
      act(() => {
        result.current.generatePassword();
      });
      
      await waitFor(() => {
        // Strength might be same or different, but should be recalculated
        expect(result.current.strength?.score).toBeDefined();
      });
    });
  });

  describe('Preferences Persistence', () => {
    it('should save options to localStorage', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.updateOptions({
          length: 32,
          excludeAmbiguous: true,
        });
      });
      
      const saved = localStorage.getItem('trustvault_password_generator_prefs');
      expect(saved).toBeTruthy();
      
      const parsed = JSON.parse(saved!);
      expect(parsed.length).toBe(32);
      expect(parsed.excludeAmbiguous).toBe(true);
    });

    it('should restore options from localStorage', () => {
      const savedOptions = {
        length: 24,
        uppercase: true,
        lowercase: true,
        numbers: false,
        symbols: true,
        excludeAmbiguous: true,
      };
      
      localStorage.setItem('trustvault_password_generator_prefs', JSON.stringify(savedOptions));
      
      const { result } = renderHook(() => usePasswordGenerator());
      
      expect(result.current.options.length).toBe(24);
      expect(result.current.options.numbers).toBe(false);
      expect(result.current.options.excludeAmbiguous).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum length', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.setLength(8);
      });
      
      await waitFor(() => {
        expect(result.current.password.length).toBeGreaterThanOrEqual(8);
      });
    });

    it('should handle maximum length', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      
      act(() => {
        result.current.setLength(128);
      });
      
      await waitFor(() => {
        expect(result.current.password.length).toBeLessThanOrEqual(128);
      });
    });

    it('should generate unique passwords', async () => {
      const { result } = renderHook(() => usePasswordGenerator());
      const passwords = new Set<string>();
      
      await waitFor(() => {
        expect(result.current.password).toBeTruthy();
      });
      
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.generatePassword();
        });
        
        await waitFor(() => {
          passwords.add(result.current.password);
        });
      }
      
      // Most should be unique (allow for very rare collisions)
      expect(passwords.size).toBeGreaterThan(8);
    });
  });
});
