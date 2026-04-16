/**
 * Password Generator Hook
 * Manages password generation state and preferences
 */

import { useState, useEffect, useCallback } from 'react';
import { generateSecurePassword, analyzePasswordStrength } from '@/core/crypto/password';

export interface PasswordGeneratorOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const DEFAULT_OPTIONS: PasswordGeneratorOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

const STORAGE_KEY = 'trustvault_password_generator_prefs';

/**
 * Load preferences from localStorage
 */
function loadPreferences(): PasswordGeneratorOptions {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PasswordGeneratorOptions>;
      return {
        ...DEFAULT_OPTIONS,
        ...parsed,
      };
    }
  } catch (error) {
    console.error('Failed to load generator preferences:', error);
  }
  return DEFAULT_OPTIONS;
}

/**
 * Save preferences to localStorage
 */
function savePreferences(options: PasswordGeneratorOptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch (error) {
    console.error('Failed to save generator preferences:', error);
  }
}

export function usePasswordGenerator() {
  // Load initial preferences
  const [options, setOptions] = useState<PasswordGeneratorOptions>(loadPreferences);
  const [password, setPassword] = useState<string>('');
  const [strength, setStrength] = useState<ReturnType<typeof analyzePasswordStrength> | null>(
    null
  );

  // Generate initial password
  useEffect(() => {
    generatePassword();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate password based on current options
  const generatePassword = useCallback(() => {
    const newPassword = generateSecurePassword(options.length, {
      lowercase: options.lowercase,
      uppercase: options.uppercase,
      numbers: options.numbers,
      symbols: options.symbols,
      excludeAmbiguous: options.excludeAmbiguous,
    });
    setPassword(newPassword);

    // Analyze strength
    const analysis = analyzePasswordStrength(newPassword);
    setStrength(analysis);
  }, [options]);

  // Update options and save to localStorage
  const updateOptions = useCallback(
    (newOptions: Partial<PasswordGeneratorOptions>) => {
      setOptions((prev) => {
        const updated = { ...prev, ...newOptions };
        savePreferences(updated);
        return updated;
      });
    },
    []
  );

  // Update length
  const setLength = useCallback(
    (length: number) => {
      updateOptions({ length });
    },
    [updateOptions]
  );

  // Toggle lowercase
  const toggleLowercase = useCallback(() => {
    updateOptions({ lowercase: !options.lowercase });
  }, [options.lowercase, updateOptions]);

  // Toggle uppercase
  const toggleUppercase = useCallback(() => {
    updateOptions({ uppercase: !options.uppercase });
  }, [options.uppercase, updateOptions]);

  // Toggle numbers
  const toggleNumbers = useCallback(() => {
    updateOptions({ numbers: !options.numbers });
  }, [options.numbers, updateOptions]);

  // Toggle symbols
  const toggleSymbols = useCallback(() => {
    updateOptions({ symbols: !options.symbols });
  }, [options.symbols, updateOptions]);

  // Toggle exclude ambiguous
  const toggleExcludeAmbiguous = useCallback(() => {
    updateOptions({ excludeAmbiguous: !options.excludeAmbiguous });
  }, [options.excludeAmbiguous, updateOptions]);

  // Regenerate when options change (excluding initial mount)
  useEffect(() => {
    if (password) {
      // Don't include generatePassword in deps to avoid infinite loop
      const newPassword = generateSecurePassword(options.length, {
        lowercase: options.lowercase,
        uppercase: options.uppercase,
        numbers: options.numbers,
        symbols: options.symbols,
        excludeAmbiguous: options.excludeAmbiguous,
      });
      setPassword(newPassword);
      setStrength(analyzePasswordStrength(newPassword));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.length,
    options.lowercase,
    options.uppercase,
    options.numbers,
    options.symbols,
    options.excludeAmbiguous,
  ]);

  return {
    password,
    strength,
    options,
    generatePassword,
    setLength,
    toggleLowercase,
    toggleUppercase,
    toggleNumbers,
    toggleSymbols,
    toggleExcludeAmbiguous,
    updateOptions,
  };
}
