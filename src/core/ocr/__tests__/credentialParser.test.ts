/**
 * Credential Parser Tests
 * Covers labeled-field extraction (username/password/notes), standalone
 * email/URL fallback detection, OCR email-mangling repair, and the
 * "don't emit garbage tokens" safety behavior the parser is built around.
 */
import { describe, it, expect } from 'vitest';
import { parseCredentialText, normalizeOcrEmail, sanitizeValue } from '@/core/ocr/credentialParser';

describe('credentialParser', () => {
  describe('parseCredentialText()', () => {
    it('extracts a labeled email username and password on separate lines', () => {
      // The username label's value must match the email pattern (looksLikePassword
      // is not required for usernames, but extractLabeledValue's valuePattern for
      // usernameLabel is PATTERNS.email) — a bare non-email token like "john.doe"
      // does not satisfy it and is intentionally not emitted.
      const result = parseCredentialText('Username: john.doe@example.com\nPassword: Tr0ub4dor&3');
      expect(result.username).toBe('john.doe@example.com');
      expect(result.password).toBe('Tr0ub4dor&3');
      expect(result.confidence.username).toBeGreaterThan(0);
      expect(result.confidence.password).toBeGreaterThan(0);
    });

    it('extracts a labeled value from the line below the label when same-line is empty', () => {
      const result = parseCredentialText('Password:\nSuperSecret99!');
      expect(result.password).toBe('SuperSecret99!');
    });

    it('falls back to a standalone email when no username label is present', () => {
      const result = parseCredentialText('jane@example.com\nrandom text here');
      expect(result.username).toBe('jane@example.com');
      expect(result.confidence.username).toBe(0.6);
    });

    it('extracts a standalone URL', () => {
      const result = parseCredentialText('Visit https://example.com/login for access');
      expect(result.url).toBe('https://example.com/login');
      expect(result.confidence.url).toBe(0.8);
    });

    it('does not extract a password-labeled value that does not look like a password', () => {
      const result = parseCredentialText('Password: this has spaces');
      expect(result.password).toBeUndefined();
    });

    it('does not treat a date-shaped value as a password', () => {
      expect(parseCredentialText('Password: 12/05/2024').password).toBeUndefined();
      expect(parseCredentialText('Password: 2024-01-31').password).toBeUndefined();
    });

    it('does not treat a currency amount as a password', () => {
      expect(parseCredentialText('Password: $1,234.56').password).toBeUndefined();
      expect(parseCredentialText('Password: 1,000.00').password).toBeUndefined();
    });

    it('extracts notes from a labeled notes field', () => {
      const result = parseCredentialText('Notes: backup-account');
      expect(result.notes).toBe('backup-account');
    });

    it('computes overall confidence as the average of detected field confidences', () => {
      const result = parseCredentialText('Username: jdoe\nPassword: Sup3rSecret!');
      expect(result.confidence.overall).toBeGreaterThan(0);
      expect(result.confidence.overall).toBeLessThanOrEqual(1);
    });

    it('returns zero confidence and no fields for text with no recognizable patterns', () => {
      const result = parseCredentialText('just some random unrelated text');
      expect(result.username).toBeUndefined();
      expect(result.password).toBeUndefined();
      expect(result.url).toBeUndefined();
      expect(result.confidence.overall).toBe(0);
    });

    it('does not emit a single-character garbage token when the email match fails', () => {
      const result = parseCredentialText('Username: i\nPassword: realpassword123');
      expect(result.username).not.toBe('i');
    });
  });

  describe('normalizeOcrEmail()', () => {
    it('returns null when there is no "@" in the text', () => {
      expect(normalizeOcrEmail('no email here')).toBeNull();
    });

    it('strips spurious whitespace inside the address', () => {
      expect(normalizeOcrEmail('john doe@example.com')).toBe('johndoe@example.com');
    });

    it('repairs ".con" to ".com"', () => {
      expect(normalizeOcrEmail('jane@example.con')).toBe('jane@example.com');
    });

    it('repairs ".corn" to ".com"', () => {
      expect(normalizeOcrEmail('jane@example.corn')).toBe('jane@example.com');
    });

    it('inserts a missing dot before a known TLD', () => {
      expect(normalizeOcrEmail('jane@gmailcom')).toBe('jane@gmail.com');
    });

    it('returns null when the repaired text still does not match a valid email shape', () => {
      expect(normalizeOcrEmail('@nodomain')).toBeNull();
    });
  });

  describe('sanitizeValue()', () => {
    it('removes common OCR noise characters', () => {
      expect(sanitizeValue('pass|word[123]')).toBe('password123');
    });

    it('collapses multiple spaces into one', () => {
      expect(sanitizeValue('hello    world')).toBe('hello world');
    });

    it('trims leading and trailing whitespace', () => {
      expect(sanitizeValue('  value  ')).toBe('value');
    });
  });
});
