/**
 * The localStorage auth snapshot must never contain offline-attack
 * material (Finding 2): no hashedMasterPassword, encryptedVaultKey,
 * salt, or webAuthnCredentials. Old snapshots must be stripped on load.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/presentation/store/authStore';
import type { User } from '@/domain/entities/User';

const fullUser: User = {
  id: 'u1',
  username: 'alice',
  displayName: 'Alice',
  hashedMasterPassword: 'scrypt$...secret...',
  encryptedVaultKey: '{"ciphertext":"..."}',
  salt: 'c2FsdA==',
  biometricEnabled: true,
  webAuthnCredentials: [
    { id: 'cred1', publicKey: 'pk', counter: 1, createdAt: new Date(),
      vaultKeyScheme: 'prf-v1', wrappedVaultKey: '{"ct":"..."}', prfSalt: 'cHJm' },
  ],
  createdAt: new Date(),
  lastLoginAt: new Date(),
  securitySettings: {
    sessionTimeoutMinutes: 15, requireBiometric: false, clipboardClearSeconds: 30,
    showPasswordStrength: true, enableSecurityAudit: true,
    passwordGenerationLength: 20, twoFactorEnabled: false,
  },
};

const SENSITIVE = ['hashedMasterPassword', 'encryptedVaultKey', 'salt',
                   'webAuthnCredentials', 'wrappedVaultKey', 'prfSalt'];

describe('auth persistence minimization', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it('persists only the {id, username, displayName} shell', async () => {
    useAuthStore.getState().setUser(fullUser);
    await useAuthStore.persist.rehydrate(); // flush write
    const raw = localStorage.getItem('trustvault-auth') ?? '';
    for (const field of SENSITIVE) {
      expect(raw).not.toContain(field);
    }
    expect(raw).toContain('"id":"u1"');
    expect(raw).toContain('"username":"alice"');
  });

  it('migrates a v0 snapshot by stripping all sensitive fields', async () => {
    localStorage.setItem('trustvault-auth', JSON.stringify({
      state: { user: { ...fullUser, createdAt: 0, lastLoginAt: 0 }, isAuthenticated: true },
      version: 0,
    }));
    await useAuthStore.persist.rehydrate();
    const raw = localStorage.getItem('trustvault-auth') ?? '';
    for (const field of SENSITIVE) {
      expect(raw).not.toContain(field);
    }
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });
});
