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

export function usePasswordGenerator() {
  // Preferences are kept in-memory only — generator options are behavioural
  // metadata that must not be persisted to disk (CWE-312).
  const [options, setOptions] = useState<PasswordGeneratorOptions>(DEFAULT_OPTIONS);
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

  const updateOptions = useCallback(
    (newOptions: Partial<PasswordGeneratorOptions>) => {
      setOptions((prev) => ({ ...prev, ...newOptions }));
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
