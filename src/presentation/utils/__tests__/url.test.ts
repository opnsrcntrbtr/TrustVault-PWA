/**
 * URL Sanitization Tests
 * Regression coverage for sanitizeUrl / normalizeUrl, incl. the control-character
 * protocol-bypass XSS vector (Sentinel HIGH, 2026-06-14).
 */

import { describe, it, expect } from 'vitest';
import { sanitizeUrl, normalizeUrl } from '../url';

describe('sanitizeUrl', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(sanitizeUrl(null)).toBe('');
    expect(sanitizeUrl(undefined)).toBe('');
    expect(sanitizeUrl('')).toBe('');
    expect(sanitizeUrl('   ')).toBe('');
  });

  it('passes through safe http(s) URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
    expect(sanitizeUrl('example.com')).toBe('example.com');
  });

  it('blocks dangerous protocols', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('about:blank');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('about:blank');
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('about:blank');
    expect(sanitizeUrl('file:///etc/passwd')).toBe('about:blank');
  });

  // Sentinel HIGH: control chars (\n, \t, \0) strip out during browser href
  // interpretation, so they must be removed BEFORE protocol validation.
  it('blocks dangerous protocols obfuscated with control characters', () => {
    expect(sanitizeUrl('java\nscript:alert(1)')).toBe('about:blank');
    expect(sanitizeUrl('java\tscript:alert(1)')).toBe('about:blank');
    expect(sanitizeUrl('javascript\n:alert(1)')).toBe('about:blank');
    expect(sanitizeUrl('\x00javascript:alert(1)')).toBe('about:blank');
    expect(sanitizeUrl('data:text/html,x')).toBe('about:blank');
  });
});

describe('normalizeUrl', () => {
  it('prepends https:// when missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
  });

  it('preserves about:blank for blocked URLs', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe('about:blank');
    expect(normalizeUrl('java\nscript:alert(1)')).toBe('about:blank');
  });

  it('returns empty for empty input', () => {
    expect(normalizeUrl('')).toBe('');
  });
});
