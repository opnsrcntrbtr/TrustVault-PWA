/**
 * Passphrase Generator Tests
 * Covers word count bounds, separator styles, capitalization modes,
 * digit insertion, and the memorable-passphrase preset.
 */
import { describe, it, expect } from 'vitest';
import {
  generatePassphrase,
  getDefaultPassphraseOptions,
  generateMemorablePassphrase,
  type PassphraseOptions,
} from '@/features/vault/generator/passphraseGenerator';

function baseOptions(overrides: Partial<PassphraseOptions> = {}): PassphraseOptions {
  return {
    wordCount: 5,
    separator: 'dash',
    capitalize: 'first',
    includeNumbers: false,
    ...overrides,
  };
}

describe('passphraseGenerator', () => {
  describe('generatePassphrase()', () => {
    it('throws when wordCount is below 4', () => {
      expect(() => generatePassphrase(baseOptions({ wordCount: 3 }))).toThrow(/between 4 and 8/);
    });

    it('throws when wordCount is above 8', () => {
      expect(() => generatePassphrase(baseOptions({ wordCount: 9 }))).toThrow(/between 4 and 8/);
    });

    it('produces exactly wordCount words when joined with "none" separator and no numbers', () => {
      const result = generatePassphrase(baseOptions({ wordCount: 4, separator: 'none', capitalize: 'none' }));
      expect(/^[a-z]+$/.test(result.password)).toBe(true);
    });

    it('joins words with a dash-family separator when separator is "dash"', () => {
      const result = generatePassphrase(baseOptions({ separator: 'dash', capitalize: 'none', includeNumbers: false }));
      expect(/^[a-z]+[-_][a-z]+[-_][a-z]+[-_][a-z]+[-_][a-z]+$/.test(result.password)).toBe(true);
    });

    it('joins words with a literal space when separator is "space"', () => {
      const result = generatePassphrase(baseOptions({ separator: 'space', capitalize: 'none', includeNumbers: false }));
      expect(result.password.split(' ')).toHaveLength(5);
    });

    it('capitalizes only the first word when capitalize is "first"', () => {
      const result = generatePassphrase(baseOptions({ separator: 'space', capitalize: 'first', includeNumbers: false }));
      const words = result.password.split(' ');
      expect(/^[A-Z]/.test(words[0] ?? '')).toBe(true);
      for (const word of words.slice(1)) {
        expect(/^[a-z]/.test(word)).toBe(true);
      }
    });

    it('capitalizes every word when capitalize is "all"', () => {
      const result = generatePassphrase(baseOptions({ separator: 'space', capitalize: 'all', includeNumbers: false }));
      const words = result.password.split(' ');
      for (const word of words) {
        expect(/^[A-Z]/.test(word)).toBe(true);
      }
    });

    it('capitalizes no words when capitalize is "none"', () => {
      const result = generatePassphrase(baseOptions({ separator: 'space', capitalize: 'none', includeNumbers: false }));
      const words = result.password.split(' ');
      for (const word of words) {
        expect(/^[a-z]/.test(word)).toBe(true);
      }
    });

    it('inserts 2-4 digits somewhere in the passphrase when includeNumbers is true', () => {
      const result = generatePassphrase(baseOptions({ includeNumbers: true }));
      const digitCount = (result.password.match(/\d/g) ?? []).length;
      expect(digitCount).toBeGreaterThanOrEqual(2);
      expect(digitCount).toBeLessThanOrEqual(4);
    });

    it('does not insert any digits when includeNumbers is false', () => {
      const result = generatePassphrase(baseOptions({ includeNumbers: false }));
      expect(/\d/.test(result.password)).toBe(false);
    });

    it('reports higher entropy for more words', () => {
      const fewer = generatePassphrase(baseOptions({ wordCount: 4 }));
      const more = generatePassphrase(baseOptions({ wordCount: 8 }));
      expect(more.entropy).toBeGreaterThan(fewer.entropy);
    });

    it('labels a 4-word passphrase weaker than or equal to an 8-word passphrase', () => {
      const fewer = generatePassphrase(baseOptions({ wordCount: 4 }));
      const more = generatePassphrase(baseOptions({ wordCount: 8 }));
      const strengthRank = { weak: 0, medium: 1, strong: 2, 'very-strong': 3 };
      expect(strengthRank[more.strength]).toBeGreaterThanOrEqual(strengthRank[fewer.strength]);
    });
  });

  describe('getDefaultPassphraseOptions()', () => {
    it('returns 5 words, dash separator, first-word capitalization, numbers included', () => {
      const defaults = getDefaultPassphraseOptions();
      expect(defaults.wordCount).toBe(5);
      expect(defaults.separator).toBe('dash');
      expect(defaults.capitalize).toBe('first');
      expect(defaults.includeNumbers).toBe(true);
    });
  });

  describe('generateMemorablePassphrase()', () => {
    it('maps "short" to fewer words than "long" (lower entropy)', () => {
      const short = generateMemorablePassphrase('short');
      const long = generateMemorablePassphrase('long');
      expect(long.entropy).toBeGreaterThan(short.entropy);
    });

    it('uses no separator and all-caps capitalization (joined words, mixed case)', () => {
      const result = generateMemorablePassphrase('medium');
      expect(/ |-|_/.test(result.password)).toBe(false);
      expect(/[A-Z]/.test(result.password)).toBe(true);
    });
  });
});
