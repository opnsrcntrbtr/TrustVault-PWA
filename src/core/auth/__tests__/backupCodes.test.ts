import { describe, it, expect } from 'vitest';
import {
  generateBackupCodes,
  validateBackupCode,
  normalizeBackupCode,
  consumeBackupCode,
} from '../backupCodes';

describe('Backup Codes', () => {
  describe('generateBackupCodes', () => {
    it('generates exactly 12 codes by default', () => {
      const codes = generateBackupCodes();
      expect(codes).toHaveLength(12);
    });

    it('generates requested count of codes', () => {
      const codes = generateBackupCodes(8);
      expect(codes).toHaveLength(8);
    });

    it('each code is 8-digit numeric string', () => {
      const codes = generateBackupCodes();
      codes.forEach((bc) => {
        expect(bc.code).toMatch(/^\d{8}$/);
      });
    });

    it('all codes are unique within the set', () => {
      const codes = generateBackupCodes();
      const uniqueCodes = new Set(codes.map((c) => c.code));
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('each code has a unique UUID id', () => {
      const codes = generateBackupCodes();
      const uniqueIds = new Set(codes.map((c) => c.id));
      expect(uniqueIds.size).toBe(codes.length);
    });

    it('consumed defaults to false', () => {
      const codes = generateBackupCodes();
      codes.forEach((bc) => {
        expect(bc.consumed).toBe(false);
      });
    });

    it('lastUsedAt is undefined initially', () => {
      const codes = generateBackupCodes();
      codes.forEach((bc) => {
        expect(bc.lastUsedAt).toBeUndefined();
      });
    });
  });

  describe('validateBackupCode', () => {
    it('accepts valid 8-digit code', () => {
      expect(validateBackupCode('12345678')).toBe(true);
    });

    it('accepts 8-digit code with space', () => {
      expect(validateBackupCode('1234 5678')).toBe(true);
    });

    it('rejects code with wrong length', () => {
      expect(validateBackupCode('1234567')).toBe(false); // 7 digits
      expect(validateBackupCode('123456789')).toBe(false); // 9 digits
    });

    it('rejects non-numeric code', () => {
      expect(validateBackupCode('1234567a')).toBe(false);
      expect(validateBackupCode('abcd5678')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(validateBackupCode('')).toBe(false);
    });

    it('rejects whitespace only', () => {
      expect(validateBackupCode('   ')).toBe(false);
    });
  });

  describe('normalizeBackupCode', () => {
    it('removes spaces from code', () => {
      expect(normalizeBackupCode('1234 5678')).toBe('12345678');
    });

    it('returns code unchanged if no spaces', () => {
      expect(normalizeBackupCode('12345678')).toBe('12345678');
    });

    it('handles multiple spaces', () => {
      expect(normalizeBackupCode('12 34 56 78')).toBe('12345678');
    });
  });

  describe('consumeBackupCode', () => {
    it('marks code consumed and sets lastUsedAt', () => {
      const codes = generateBackupCodes();
      const firstCode = codes[0];
      if (!firstCode) throw new Error('No code generated');

      const result = consumeBackupCode(codes, firstCode.code);
      expect(result).not.toBeNull();

      const consumed = result?.[0];
      if (!consumed) throw new Error('No consumed code');
      expect(consumed.consumed).toBe(true);
      expect(consumed.lastUsedAt).toBeDefined();
      expect(consumed.lastUsedAt).toBeGreaterThan(0);
    });

    it('accepts code with spaces', () => {
      const codes = generateBackupCodes();
      const firstCode = codes[0];
      if (!firstCode) throw new Error('No code generated');

      const result = consumeBackupCode(codes, `${firstCode.code.slice(0, 4)} ${firstCode.code.slice(4)}`);
      expect(result).not.toBeNull();
    });

    it('returns null if code not found', () => {
      const codes = generateBackupCodes();
      const result = consumeBackupCode(codes, '99999999');
      expect(result).toBeNull();
    });

    it('returns null if code already consumed', () => {
      const codes = generateBackupCodes();
      const firstCode = codes[0];
      if (!firstCode) throw new Error('No code generated');

      // Consume once
      const result1 = consumeBackupCode(codes, firstCode.code);
      expect(result1).not.toBeNull();

      // Try to consume again
      if (!result1) throw new Error('First consumption failed');
      const result2 = consumeBackupCode(result1, firstCode.code);
      expect(result2).toBeNull();
    });

    it('does not mutate the input array', () => {
      const codes = generateBackupCodes();
      const firstCode = codes[0];
      if (!firstCode) throw new Error('No code generated');

      const originalLength = codes.length;
      const originalFirstConsumed = codes[0]?.consumed ?? false;

      consumeBackupCode(codes, firstCode.code);

      expect(codes).toHaveLength(originalLength);
      expect(codes[0]?.consumed).toBe(originalFirstConsumed); // unchanged
    });

    it('returns a new array with code consumed', () => {
      const codes = generateBackupCodes();
      const firstCode = codes[0];
      if (!firstCode) throw new Error('No code generated');

      const result = consumeBackupCode(codes, firstCode.code);
      expect(result).not.toBe(codes); // different array reference
    });
  });
});
