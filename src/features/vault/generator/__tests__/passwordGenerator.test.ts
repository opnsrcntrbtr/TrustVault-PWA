/**
 * Password Generator Tests
 * Covers the character-set option matrix, entropy/strength calculation,
 * character diversity guarantee, and boundary validation.
 */
import { describe, it, expect } from 'vitest';
import {
  generatePassword,
  generatePasswords,
  getDefaultOptions,
  generatePronounceablePassword,
  type PasswordGeneratorOptions,
} from '@/features/vault/generator/passwordGenerator';

function baseOptions(overrides: Partial<PasswordGeneratorOptions> = {}): PasswordGeneratorOptions {
  return {
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: false,
    ...overrides,
  };
}

describe('passwordGenerator', () => {
  describe('generatePassword()', () => {
    it('produces a password of the exact requested length', () => {
      const result = generatePassword(baseOptions({ length: 24 }));
      expect(result.password).toHaveLength(24);
    });

    it('includes at least one character from every enabled set', () => {
      const result = generatePassword(baseOptions());
      expect(/[A-Z]/.test(result.password)).toBe(true);
      expect(/[a-z]/.test(result.password)).toBe(true);
      expect(/[0-9]/.test(result.password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(result.password)).toBe(true);
    });

    it('only uses lowercase characters when other sets are disabled', () => {
      const result = generatePassword(baseOptions({
        includeUppercase: false,
        includeNumbers: false,
        includeSymbols: false,
      }));
      expect(/^[a-z]+$/.test(result.password)).toBe(true);
    });

    it('excludes ambiguous characters when requested', () => {
      const result = generatePassword(baseOptions({ length: 64, excludeAmbiguous: true }));
      expect(/[0Oo1lIi|]/.test(result.password)).toBe(false);
    });

    it('uses a custom charset verbatim when provided', () => {
      const result = generatePassword(baseOptions({ length: 10, customCharset: 'ab' }));
      expect(/^[ab]+$/.test(result.password)).toBe(true);
    });

    it('throws when length is below the minimum (8)', () => {
      expect(() => generatePassword(baseOptions({ length: 7 }))).toThrow(/between 8 and 128/);
    });

    it('throws when length is above the maximum (128)', () => {
      expect(() => generatePassword(baseOptions({ length: 129 }))).toThrow(/between 8 and 128/);
    });

    it('throws when no character set is selected', () => {
      expect(() => generatePassword(baseOptions({
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
      }))).toThrow(/At least one character set/);
    });

    it('reports increasing entropy for longer passwords with the same charset', () => {
      const short = generatePassword(baseOptions({ length: 8 }));
      const long = generatePassword(baseOptions({ length: 32 }));
      expect(long.entropy).toBeGreaterThan(short.entropy);
    });

    it('labels low-entropy short passwords as weak and long ones as very-strong', () => {
      const weak = generatePassword(baseOptions({
        length: 8,
        includeUppercase: false,
        includeNumbers: false,
        includeSymbols: false,
      }));
      const veryStrong = generatePassword(baseOptions({ length: 32 }));

      expect(weak.strength).toBe('weak');
      expect(veryStrong.strength).toBe('very-strong');
    });

    it('generates different passwords across repeated calls (no fixed seed)', () => {
      const results = new Set(Array.from({ length: 20 }, () => generatePassword(baseOptions()).password));
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('generatePasswords()', () => {
    it('returns the requested count of passwords', () => {
      const results = generatePasswords(5, baseOptions());
      expect(results).toHaveLength(5);
    });

    it('throws when count is below 1', () => {
      expect(() => generatePasswords(0, baseOptions())).toThrow(/between 1 and 100/);
    });

    it('throws when count exceeds 100', () => {
      expect(() => generatePasswords(101, baseOptions())).toThrow(/between 1 and 100/);
    });
  });

  describe('getDefaultOptions()', () => {
    it('returns secure-by-default options (16 chars, all sets enabled, ambiguous not excluded)', () => {
      const defaults = getDefaultOptions();
      expect(defaults.length).toBe(16);
      expect(defaults.includeUppercase).toBe(true);
      expect(defaults.includeLowercase).toBe(true);
      expect(defaults.includeNumbers).toBe(true);
      expect(defaults.includeSymbols).toBe(true);
      expect(defaults.excludeAmbiguous).toBe(false);
    });
  });

  describe('generatePronounceablePassword()', () => {
    it('produces a password of the requested length', () => {
      const result = generatePronounceablePassword(12);
      expect(result.password).toHaveLength(12);
    });

    it('throws when length is below 8', () => {
      expect(() => generatePronounceablePassword(7)).toThrow(/between 8 and 128/);
    });

    it('throws when length is above 128', () => {
      expect(() => generatePronounceablePassword(129)).toThrow(/between 8 and 128/);
    });

    it('only uses consonants, vowels, and digits', () => {
      const result = generatePronounceablePassword(16);
      expect(/^[a-zA-Z0-9]+$/.test(result.password)).toBe(true);
    });
  });
});
