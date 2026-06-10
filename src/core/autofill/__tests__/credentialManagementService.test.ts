/**
 * Autofill domain matcher security tests
 *
 * The matcher must never treat a public suffix (co.uk, com.au, …) as a
 * shared "domain". Without a Public Suffix List, the only safe rule is:
 * hostnames match when equal, or when one is a dot-boundary suffix of the
 * other (credential stored for example.com may fill login.example.com).
 */

import { describe, it, expect } from 'vitest';
import type { Credential } from '@/domain/entities/Credential';
import {
  extractOrigin,
  validateOrigin,
  validateDomain,
  calculateMatchConfidence,
  findMatchingCredentials,
} from '../credentialManagementService';

function makeLoginCredential(overrides: Partial<Credential>): Credential {
  return {
    id: 'cred-1',
    title: 'Test',
    username: 'user@example.com',
    password: 'secret',
    category: 'login',
    url: 'https://example.com',
    tags: [],
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('extractOrigin', () => {
  it('returns the origin of a valid URL', () => {
    expect(extractOrigin('https://www.example.com/login')).toBe('https://www.example.com');
  });

  it('returns null for invalid URLs', () => {
    expect(extractOrigin('not a url')).toBeNull();
  });
});

describe('validateOrigin', () => {
  it('matches identical origins only', () => {
    expect(validateOrigin('https://example.com/login', 'https://example.com')).toBe(true);
    expect(validateOrigin('https://example.com', 'https://login.example.com')).toBe(false);
    expect(validateOrigin('https://example.com', 'http://example.com')).toBe(false);
  });
});

describe('validateDomain (cross-subdomain matching)', () => {
  it('does NOT match two different sites under a multi-part public suffix', () => {
    // The classic eTLD bug: "last two labels" turns mybank.co.uk into co.uk
    expect(validateDomain('https://mybank.co.uk', 'https://evil.co.uk')).toBe(false);
    expect(validateDomain('https://accounts.mybank.co.uk', 'https://evil.co.uk')).toBe(false);
    expect(validateDomain('https://shop.com.au', 'https://attacker.com.au')).toBe(false);
  });

  it('matches a subdomain of the stored credential host', () => {
    expect(validateDomain('https://example.com', 'https://www.example.com')).toBe(true);
    expect(validateDomain('https://example.co.uk', 'https://login.example.co.uk')).toBe(true);
  });

  it('matches the parent host of a stored subdomain credential', () => {
    expect(validateDomain('https://www.example.com', 'https://example.com')).toBe(true);
  });

  it('requires a dot boundary — lookalike hosts never match', () => {
    expect(validateDomain('https://example.com', 'https://evil-example.com')).toBe(false);
    expect(validateDomain('https://example.com', 'https://notexample.com')).toBe(false);
  });

  it('does NOT match sibling subdomains (neither is a suffix of the other)', () => {
    expect(validateDomain('https://login.example.com', 'https://mail.example.com')).toBe(false);
  });

  it('requires matching schemes — no https→http downgrade fills', () => {
    expect(validateDomain('https://example.com', 'http://www.example.com')).toBe(false);
    expect(validateDomain('http://example.com', 'https://www.example.com')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(validateDomain('not a url', 'https://example.com')).toBe(false);
    expect(validateDomain('https://example.com', '')).toBe(false);
  });
});

describe('calculateMatchConfidence', () => {
  it('scores exact origin match as 100', () => {
    expect(calculateMatchConfidence('https://example.com', 'https://example.com')).toBe(100);
  });

  it('scores safe cross-subdomain match as 75', () => {
    expect(calculateMatchConfidence('https://example.com', 'https://login.example.com')).toBe(75);
  });

  it('scores cross-site public-suffix neighbours as 0', () => {
    expect(calculateMatchConfidence('https://mybank.co.uk', 'https://evil.co.uk')).toBe(0);
  });

  it('scores empty or invalid credential URLs as 0', () => {
    expect(calculateMatchConfidence('', 'https://example.com')).toBe(0);
    expect(calculateMatchConfidence('not a url', 'https://example.com')).toBe(0);
  });
});

describe('findMatchingCredentials', () => {
  it('never offers credentials from a different site sharing a public suffix', () => {
    const credentials = [
      makeLoginCredential({ id: 'bank', url: 'https://mybank.co.uk' }),
      makeLoginCredential({ id: 'exact', url: 'https://evil.co.uk' }),
    ];

    const matches = findMatchingCredentials(credentials, 'https://evil.co.uk');

    expect(matches.map(m => m.credential.id)).toEqual(['exact']);
  });

  it('ranks exact origin above cross-subdomain matches', () => {
    const credentials = [
      makeLoginCredential({ id: 'apex', url: 'https://example.com' }),
      makeLoginCredential({ id: 'exact', url: 'https://login.example.com' }),
    ];

    const matches = findMatchingCredentials(credentials, 'https://login.example.com');

    expect(matches.map(m => m.credential.id)).toEqual(['exact', 'apex']);
    expect(matches[0]?.confidence).toBe(100);
    expect(matches[1]?.confidence).toBe(75);
  });

  it('skips non-login credentials and credentials without URLs', () => {
    const credentials = [
      makeLoginCredential({ id: 'note', category: 'secure_note' }),
      makeLoginCredential({ id: 'nourl', url: undefined }),
    ];

    expect(findMatchingCredentials(credentials, 'https://example.com')).toEqual([]);
  });
});
