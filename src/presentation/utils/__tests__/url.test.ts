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

  // Allowlist posture: only http(s) are safe link schemes. A blocklist lets any
  // unlisted scheme through (blob:, filesystem:, intent:, etc.), so we deny by
  // default and permit only the explicitly-safe protocols.
  it('blocks non-http(s) schemes not on the legacy blocklist', () => {
    expect(sanitizeUrl('blob:https://evil.com/uuid')).toBe('about:blank');
    expect(sanitizeUrl('filesystem:https://evil.com/temporary/x')).toBe('about:blank');
    expect(sanitizeUrl('intent://evil#Intent;scheme=https;end')).toBe('about:blank');
    expect(sanitizeUrl('ftp://evil.com/x')).toBe('about:blank');
    expect(sanitizeUrl('chrome://settings')).toBe('about:blank');
  });

  it('still allows plain http(s) and bare hosts', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    expect(sanitizeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
    expect(sanitizeUrl('example.com')).toBe('example.com');
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
