/**
 * Tests for username validation & normalization helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeUsername,
  usernameKey,
  validateUsername,
} from '../usernameValidation';

describe('normalizeUsername', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeUsername('  alice  ')).toBe('alice');
  });

  it('applies NFKC folding to defeat look-alike characters', () => {
    // U+FF41 FULLWIDTH LATIN SMALL LETTER A → 'a'
    expect(normalizeUsername('ａlice')).toBe('alice');
  });
});

describe('usernameKey', () => {
  it('lowercases for case-insensitive uniqueness', () => {
    expect(usernameKey('Alice')).toBe('alice');
    expect(usernameKey('  BOB ')).toBe('bob');
  });
});

describe('validateUsername', () => {
  it('accepts a well-formed username', () => {
    expect(validateUsername('alice.99_x-1')).toEqual({ valid: true });
  });

  it('rejects empty input', () => {
    expect(validateUsername('   ').valid).toBe(false);
  });

  it('rejects too-short input', () => {
    expect(validateUsername('ab').valid).toBe(false);
  });

  it('rejects too-long input', () => {
    expect(validateUsername('a'.repeat(33)).valid).toBe(false);
  });

  it('rejects disallowed characters', () => {
    expect(validateUsername('al ice').valid).toBe(false);
    expect(validateUsername('aliçe').valid).toBe(false); // ç
    expect(validateUsername('a@b.com').valid).toBe(false);
  });

  it('rejects reserved names case-insensitively', () => {
    expect(validateUsername('admin').valid).toBe(false);
    expect(validateUsername('Root').valid).toBe(false);
    expect(validateUsername('TrustVault').valid).toBe(false);
  });
});
