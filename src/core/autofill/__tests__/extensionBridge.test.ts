/**
 * Extension Autofill Bridge Tests
 *
 * Tests resolveCredentialsForOrigin — the core logic wiring the dot-boundary
 * matcher (findMatchingCredentials) to the extension fill path
 * (GAP_ANALYSIS.md Section 17 #4). Exercises auth/lock gating, autofill
 * opt-in gating, domain matching, and minimal credential projection.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '@/presentation/store/authStore';

// ---------------------------------------------------------------------------
// Module mocks - hoisted before the module under test is imported
// ---------------------------------------------------------------------------

vi.mock('@/data/repositories/CredentialRepositoryImpl', () => ({
  credentialRepository: { findAll: vi.fn() },
}));

vi.mock('@/core/autofill/autofillSettings', () => ({
  loadAutofillSettings: vi.fn(),
  isAutofillEnabledForOrigin: vi.fn(() => true),
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock hoisting)
// ---------------------------------------------------------------------------

import { resolveCredentialsForOrigin } from '../extensionBridge';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { isAutofillEnabledForOrigin } from '@/core/autofill/autofillSettings';
import type { Credential } from '@/domain/entities/Credential';
import type { User } from '@/domain/entities/User';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindAll = vi.mocked(credentialRepository.findAll);
const mockIsEnabled = vi.mocked(isAutofillEnabledForOrigin);

function cred(overrides: Partial<Credential> = {}): Credential {
  return {
    id: 'cred-1',
    userId: 'user-1',
    title: 'GitHub',
    username: 'dev@example.com',
    password: 'SecretPass1!',
    url: 'https://github.com',
    category: 'login',
    tags: [],
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function unlockVault(): void {
  useAuthStore.setState({
    user: { id: 'user-1' } as unknown as User,
    vaultKey: {} as CryptoKey,
    isLocked: false,
    isAuthenticated: true,
  });
}

function lockVault(): void {
  useAuthStore.setState({ vaultKey: null, isLocked: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveCredentialsForOrigin', () => {
  beforeAll(() => {
    lockVault();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEnabled.mockReturnValue(true);
    lockVault();
  });

  afterEach(() => {
    lockVault();
  });

  it('returns [] when vault is locked', async () => {
    // vault stays locked from beforeEach
    mockFindAll.mockResolvedValue([cred()]);

    const result = await resolveCredentialsForOrigin('https://github.com');

    expect(result).toEqual([]);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('returns [] when autofill is disabled for the origin', async () => {
    unlockVault();
    mockIsEnabled.mockReturnValue(false);
    mockFindAll.mockResolvedValue([cred()]);

    const result = await resolveCredentialsForOrigin('https://github.com');

    expect(result).toEqual([]);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('returns matched credentials with only username/password/title fields', async () => {
    unlockVault();
    mockFindAll.mockResolvedValue([
      cred({ url: 'https://github.com', username: 'dev@example.com', password: 'SecretPass1!', title: 'GitHub' }),
      cred({ id: 'cred-2', url: 'https://gitlab.com', username: 'other@example.com', password: 'Other2!', title: 'GitLab' }),
    ]);

    const result = await resolveCredentialsForOrigin('https://github.com');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ username: 'dev@example.com', password: 'SecretPass1!', title: 'GitHub' });
    // No extra fields - minimal surface area passed to the extension
    expect((result[0] as Record<string, unknown>)['id']).toBeUndefined();
    expect((result[0] as Record<string, unknown>)['url']).toBeUndefined();
  });

  it('dot-boundary matcher: subdomain matches parent-domain credential', async () => {
    unlockVault();
    mockFindAll.mockResolvedValue([
      cred({ url: 'https://example.com', username: 'user@example.com', password: 'Pass1!', title: 'Example' }),
    ]);

    const result = await resolveCredentialsForOrigin('https://www.example.com');

    expect(result).toHaveLength(1);
    expect(result[0]?.username).toBe('user@example.com');
  });

  it('dot-boundary matcher: sibling subdomains do NOT match each other', async () => {
    unlockVault();
    mockFindAll.mockResolvedValue([
      cred({ url: 'https://login.example.com', username: 'u', password: 'p', title: 'Login' }),
    ]);

    const result = await resolveCredentialsForOrigin('https://mail.example.com');

    expect(result).toEqual([]);
  });

  it('ignores non-login category credentials', async () => {
    unlockVault();
    mockFindAll.mockResolvedValue([
      cred({ category: 'card', url: 'https://github.com' }),
    ]);

    const result = await resolveCredentialsForOrigin('https://github.com');

    expect(result).toEqual([]);
  });

  it('returns [] and does not throw when findAll rejects', async () => {
    unlockVault();
    mockFindAll.mockRejectedValue(new Error('DB error'));

    const result = await resolveCredentialsForOrigin('https://github.com');

    expect(result).toEqual([]);
  });

  it('sorts results highest-confidence first (exact origin before subdomain)', async () => {
    unlockVault();
    mockFindAll.mockResolvedValue([
      cred({ id: 'sub', url: 'https://sub.example.com', title: 'Sub', username: 'sub@u', password: 'p' }),
      cred({ id: 'apex', url: 'https://example.com', title: 'Apex', username: 'apex@u', password: 'p' }),
    ]);

    const result = await resolveCredentialsForOrigin('https://sub.example.com');

    // exact origin (sub.example.com) → confidence 100 comes before apex (75)
    expect(result[0]?.title).toBe('Sub');
    expect(result[1]?.title).toBe('Apex');
  });
});
