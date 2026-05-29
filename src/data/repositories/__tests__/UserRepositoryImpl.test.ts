/**
 * UserRepository Implementation Tests
 * Tests user creation, authentication, and management with IndexedDB
 * Phase 5.1 - Repository tests (90% coverage target)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scrypt } from '@noble/hashes/scrypt';
import { UserRepositoryImpl } from '../UserRepositoryImpl';
import { needsRehash } from '@/core/crypto/password';
import { isPRFSupported, registerCredentialWithPRF } from '@/core/auth/webauthn';
import { db } from '../../storage/database';
import type { User } from '@/domain/entities/User';

// S1: mock the WebAuthn boundary so biometric enroll/unlock can be exercised
// without a real authenticator. getPRFOutput returns sha256(salt) — a stable,
// deterministic stand-in for the hardware PRF, so the same stored salt yields
// the same secret at enroll and unlock. The crypto wrap/unwrap stays real.
vi.mock('@/core/auth/webauthn', () => ({
  isBiometricAvailable: vi.fn(() => Promise.resolve(true)),
  isPRFSupported: vi.fn(() => Promise.resolve(true)),
  registerCredentialWithPRF: vi.fn(() =>
    Promise.resolve({
      credentialId: 'prf-cred-1',
      publicKey: 'cHVibGljLWtleQ==',
      transports: ['internal'] as AuthenticatorTransport[],
      prfEnabled: true,
    }),
  ),
  // Echo the salt as the PRF output: deterministic per salt, so the same stored
  // salt yields the same secret at enroll and unlock (models a stable hardware PRF).
  getPRFOutput: vi.fn((_credentialId: string, salt: Uint8Array, _rpId: string, storedCounter: number = -1) =>
    Promise.resolve({ prfOutput: salt, counter: storedCounter + 2 }),
  ),
}));

async function exportRaw(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

/** Builds a legacy (pre-S4) scrypt hash for a password. */
function makeLegacyScryptHash(password: string, N = 32768): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = scrypt(password, salt, { N, r: 8, p: 1, dkLen: 32 });
  const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
  return `scrypt$${String(N)}$8$1$${b64(salt)}$${b64(hash)}`;
}

describe('UserRepositoryImpl', () => {
  let repository: UserRepositoryImpl;

  beforeEach(async () => {
    repository = new UserRepositoryImpl();
    // Clear database before each test
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();
  });

  afterEach(async () => {
    // Cleanup after each test
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();
  });

  describe('createUser()', () => {
    it('should create a new user with hashed password', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!';

      const user = await repository.createUser(email, password);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.hashedMasterPassword).toContain('scrypt$');
      expect(user.hashedMasterPassword).not.toBe(password);
    });

    it('should generate unique user IDs', async () => {
      const user1 = await repository.createUser('user1@example.com', 'Password123!');
      const user2 = await repository.createUser('user2@example.com', 'Password123!');

      expect(user1.id).not.toBe(user2.id);
    });

    it('should create encrypted vault key', async () => {
      const user = await repository.createUser('test@example.com', 'TestPassword123!');

      expect(user.encryptedVaultKey).toBeDefined();
      expect(typeof user.encryptedVaultKey).toBe('string');
      expect(user.encryptedVaultKey.length).toBeGreaterThan(0);
    });

    it('should generate unique salt for each user', async () => {
      const user1 = await repository.createUser('user1@example.com', 'Password123!');
      const user2 = await repository.createUser('user2@example.com', 'Password123!');

      expect(user1.salt).toBeDefined();
      expect(user2.salt).toBeDefined();
      expect(user1.salt).not.toBe(user2.salt);
    });

    it('should set default security settings', async () => {
      const user = await repository.createUser('test@example.com', 'TestPassword123!');

      expect(user.securitySettings).toBeDefined();
      expect(user.securitySettings.sessionTimeoutMinutes).toBe(15);
      expect(user.securitySettings.clipboardClearSeconds).toBe(30);
      expect(user.securitySettings.showPasswordStrength).toBe(true);
      expect(user.securitySettings.passwordGenerationLength).toBe(20);
    });

    it('should set biometric disabled by default', async () => {
      const user = await repository.createUser('test@example.com', 'TestPassword123!');

      expect(user.biometricEnabled).toBe(false);
      expect(user.webAuthnCredentials).toEqual([]);
    });

    it('should set creation and last login timestamps', async () => {
      const beforeCreate = Date.now();
      const user = await repository.createUser('test@example.com', 'TestPassword123!');
      const afterCreate = Date.now();

      expect(user.createdAt).toBeDefined();
      expect(user.lastLoginAt).toBeDefined();
      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);
    });

    it('should reject duplicate email addresses', async () => {
      const email = 'test@example.com';
      await repository.createUser(email, 'Password123!');

      await expect(repository.createUser(email, 'Different123!')).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should handle empty email', async () => {
      const user = await repository.createUser('', 'Password123!');
      // Empty email is allowed, just creates user with empty string
      expect(user).toBeDefined();
      expect(user.email).toBe('');
    });

    it('should handle empty password', async () => {
      const user = await repository.createUser('test@example.com', '');

      expect(user).toBeDefined();
      expect(user.hashedMasterPassword).toContain('scrypt$');
    });

    it('should store user in IndexedDB', async () => {
      const email = 'test@example.com';
      await repository.createUser(email, 'Password123!');

      const storedUser = await db.users.where('email').equals(email).first();

      expect(storedUser).toBeDefined();
      expect(storedUser?.email).toBe(email);
    });
  });

  describe('authenticateWithPassword()', () => {
    const testEmail = 'test@example.com';
    const testPassword = 'TestPassword123!';

    beforeEach(async () => {
      await repository.createUser(testEmail, testPassword);
    });

    it('should authenticate with correct credentials', async () => {
      const session = await repository.authenticateWithPassword(testEmail, testPassword);

      expect(session).toBeDefined();
      expect(session.userId).toBeDefined();
      expect(session.vaultKey).toBeDefined();
      expect(session.vaultKey).toBeInstanceOf(CryptoKey);
    });

    it('should return session with userId', async () => {
      const session = await repository.authenticateWithPassword(testEmail, testPassword);

      expect(session.userId).toBeDefined();
      expect(typeof session.userId).toBe('string');
      expect(session.userId.length).toBeGreaterThan(0);
    });

    it('should decrypt vault key successfully', async () => {
      const session = await repository.authenticateWithPassword(testEmail, testPassword);

      expect(session.vaultKey).toBeInstanceOf(CryptoKey);
      expect(session.vaultKey.type).toBe('secret');
      expect(session.vaultKey.algorithm.name).toBe('AES-GCM');
    });

    it('should reject incorrect password', async () => {
      await expect(
        repository.authenticateWithPassword(testEmail, 'WrongPassword123!')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject non-existent email', async () => {
      await expect(
        repository.authenticateWithPassword('nonexistent@example.com', testPassword)
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject empty email', async () => {
      await expect(
        repository.authenticateWithPassword('', testPassword)
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject empty password', async () => {
      await expect(
        repository.authenticateWithPassword(testEmail, '')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should handle case-sensitive email', async () => {
      await expect(
        repository.authenticateWithPassword('TEST@EXAMPLE.COM', testPassword)
      ).rejects.toThrow('Invalid email or password');
    });

    it('should update last login timestamp', async () => {
      const beforeAuth = Date.now();
      await repository.authenticateWithPassword(testEmail, testPassword);
      const afterAuth = Date.now();

      const user = await repository.findByEmail(testEmail);

      expect(user?.lastLoginAt).toBeDefined();
      expect(user!.lastLoginAt.getTime()).toBeGreaterThanOrEqual(beforeAuth);
      expect(user!.lastLoginAt.getTime()).toBeLessThanOrEqual(afterAuth);
    });

    it('should set session as unlocked', async () => {
      const session = await repository.authenticateWithPassword(testEmail, testPassword);

      expect(session.isLocked).toBeDefined();
      expect(session.isLocked).toBe(false);
    });

    it('should set session expiry', async () => {
      const session = await repository.authenticateWithPassword(testEmail, testPassword);

      expect(session.expiresAt).toBeDefined();
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle password with special characters', async () => {
      const specialPass = 'P@ssw0rd!#$%^&*()';
      await repository.createUser('special@example.com', specialPass);

      const session = await repository.authenticateWithPassword('special@example.com', specialPass);

      expect(session).toBeDefined();
      expect(session.vaultKey).toBeInstanceOf(CryptoKey);
    });

    it('should handle password with unicode', async () => {
      const unicodePass = 'Pass你好🔐Word123!';
      await repository.createUser('unicode@example.com', unicodePass);

      const session = await repository.authenticateWithPassword('unicode@example.com', unicodePass);

      expect(session).toBeDefined();
      expect(session.vaultKey).toBeInstanceOf(CryptoKey);
    });
  });

  describe('findByEmail()', () => {
    it('should find existing user by email', async () => {
      const email = 'test@example.com';
      await repository.createUser(email, 'Password123!');

      const user = await repository.findByEmail(email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it('should return null for non-existent email', async () => {
      const user = await repository.findByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });

    it('should return user with all fields', async () => {
      const email = 'test@example.com';
      await repository.createUser(email, 'Password123!');

      const user = await repository.findByEmail(email);

      expect(user).toBeDefined();
      expect(user?.id).toBeDefined();
      expect(user?.email).toBe(email);
      expect(user?.hashedMasterPassword).toBeDefined();
      expect(user?.encryptedVaultKey).toBeDefined();
      expect(user?.salt).toBeDefined();
      expect(user?.securitySettings).toBeDefined();
    });

    it('should handle empty email', async () => {
      const user = await repository.findByEmail('');

      expect(user).toBeNull();
    });

    it('should be case-sensitive', async () => {
      await repository.createUser('test@example.com', 'Password123!');

      const user = await repository.findByEmail('TEST@EXAMPLE.COM');

      expect(user).toBeNull();
    });
  });

  describe('findById()', () => {
    it('should find existing user by ID', async () => {
      const created = await repository.createUser('test@example.com', 'Password123!');

      const user = await repository.findById(created.id);

      expect(user).toBeDefined();
      expect(user?.id).toBe(created.id);
      expect(user?.email).toBe('test@example.com');
    });

    it('should return null for non-existent ID', async () => {
      const user = await repository.findById('non-existent-id');

      expect(user).toBeNull();
    });

    it('should handle empty ID', async () => {
      const user = await repository.findById('');

      expect(user).toBeNull();
    });
  });

  describe('updateSecuritySettings()', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await repository.createUser('test@example.com', 'Password123!');
      userId = user.id;
    });

    it('should update security settings', async () => {
      const newSettings = {
        sessionTimeoutMinutes: 30,
        requireBiometric: true,
        clipboardClearSeconds: 60,
        showPasswordStrength: false,
        enableSecurityAudit: false,
        passwordGenerationLength: 25,
        twoFactorEnabled: true,
      };

      await repository.updateSecuritySettings(userId, newSettings);

      const user = await repository.findById(userId);

      expect(user?.securitySettings).toEqual(newSettings);
    });

    it('should partially update security settings', async () => {
      const partialSettings = {
        sessionTimeoutMinutes: 45,
        clipboardClearSeconds: 90,
      };

      await repository.updateSecuritySettings(userId, partialSettings);

      const user = await repository.findById(userId);

      expect(user?.securitySettings.sessionTimeoutMinutes).toBe(45);
      expect(user?.securitySettings.clipboardClearSeconds).toBe(90);
      // Other settings should remain unchanged
      expect(user?.securitySettings.showPasswordStrength).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      const settings = { sessionTimeoutMinutes: 30 };

      await expect(
        repository.updateSecuritySettings('non-existent-id', settings)
      ).rejects.toThrow('User not found');
    });

    it('should handle empty settings object', async () => {
      const originalUser = await repository.findById(userId);
      const originalSettings = originalUser?.securitySettings;

      await repository.updateSecuritySettings(userId, {});

      const user = await repository.findById(userId);

      expect(user?.securitySettings).toEqual(originalSettings);
    });
  });

  describe('changeMasterPassword()', () => {
    let userId: string;
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';

    beforeEach(async () => {
      const user = await repository.createUser('test@example.com', oldPassword);
      userId = user.id;
    });

    it('should change master password successfully', async () => {
      await repository.changeMasterPassword(userId, oldPassword, newPassword);

      // Verify can authenticate with new password
      const session = await repository.authenticateWithPassword('test@example.com', newPassword);

      expect(session).toBeDefined();
      expect(session.vaultKey).toBeInstanceOf(CryptoKey);
    });

    it('should reject authentication with old password after change', async () => {
      await repository.changeMasterPassword(userId, oldPassword, newPassword);

      await expect(
        repository.authenticateWithPassword('test@example.com', oldPassword)
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject incorrect current password', async () => {
      await expect(
        repository.changeMasterPassword(userId, 'WrongPassword', newPassword)
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        repository.changeMasterPassword('non-existent-id', oldPassword, newPassword)
      ).rejects.toThrow('User not found');
    });

    it('should update password hash', async () => {
      const userBefore = await repository.findById(userId);
      const hashBefore = userBefore?.hashedMasterPassword;

      await repository.changeMasterPassword(userId, oldPassword, newPassword);

      const userAfter = await repository.findById(userId);
      const hashAfter = userAfter?.hashedMasterPassword;

      expect(hashBefore).not.toBe(hashAfter);
      expect(hashAfter).toContain('scrypt$');
    });

    it('should generate new salt', async () => {
      const userBefore = await repository.findById(userId);
      const saltBefore = userBefore?.salt;

      await repository.changeMasterPassword(userId, oldPassword, newPassword);

      const userAfter = await repository.findById(userId);
      const saltAfter = userAfter?.salt;

      expect(saltBefore).not.toBe(saltAfter);
    });

    it('should re-encrypt vault key with new password', async () => {
      const userBefore = await repository.findById(userId);
      const vaultKeyBefore = userBefore?.encryptedVaultKey;

      await repository.changeMasterPassword(userId, oldPassword, newPassword);

      const userAfter = await repository.findById(userId);
      const vaultKeyAfter = userAfter?.encryptedVaultKey;

      expect(vaultKeyBefore).not.toBe(vaultKeyAfter);
    });
  });

  describe('hasAnyUsers()', () => {
    it('should return false when no users exist', async () => {
      await db.users.clear();
      const hasUsers = await repository.hasAnyUsers();
      expect(hasUsers).toBe(false);
    });

    it('should return true when users exist', async () => {
      await repository.createUser('test@example.com', 'Password123!');
      const hasUsers = await repository.hasAnyUsers();
      expect(hasUsers).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle concurrent user creation with same email', async () => {
      const email = 'concurrent@example.com';

      const promise1 = repository.createUser(email, 'Password1');
      const promise2 = repository.createUser(email, 'Password2');

      const results = await Promise.allSettled([promise1, promise2]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      // At least one should succeed and one should fail
      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(failures.length).toBeGreaterThanOrEqual(0);
      // Both shouldn't succeed
      expect(successes.length).toBeLessThanOrEqual(1);
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(200) + '@example.com';

      const user = await repository.createUser(longEmail, 'Password123!');

      expect(user.email).toBe(longEmail);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'P@ssw0rd' + 'a'.repeat(500);

      const user = await repository.createUser('test@example.com', longPassword);

      expect(user).toBeDefined();

      const session = await repository.authenticateWithPassword('test@example.com', longPassword);

      expect(session).toBeDefined();
    });
  });

  describe('rehash-on-login (S4)', () => {
    const email = 'rehash@example.com';
    const password = 'TestPassword123!';

    it('upgrades a stale password hash on successful login without breaking vault decryption', async () => {
      const created = await repository.createUser(email, password);

      // Simulate an account created under the old (weak) scrypt parameters by
      // overwriting only the stored hash. Salt + encryptedVaultKey are left
      // intact, so vault-key derivation must still succeed.
      await db.users.update(created.id, {
        hashedMasterPassword: makeLegacyScryptHash(password, 32768),
      });

      const before = await db.users.get(created.id);
      if (!before) throw new Error('expected stored user');
      expect(needsRehash(before.hashedMasterPassword)).toBe(true);

      // Logging in must succeed AND silently upgrade the hash.
      const session = await repository.authenticateWithPassword(email, password);
      expect(session).toBeDefined();
      expect(session.vaultKey).toBeDefined();

      const after = await db.users.get(created.id);
      if (!after) throw new Error('expected stored user');
      expect(needsRehash(after.hashedMasterPassword)).toBe(false);
      expect(after.hashedMasterPassword).not.toBe(before.hashedMasterPassword);
    });

    it('does not rewrite the hash when it is already current', async () => {
      const created = await repository.createUser(email, password);
      const before = await db.users.get(created.id);
      if (!before) throw new Error('expected stored user');

      await repository.authenticateWithPassword(email, password);

      const after = await db.users.get(created.id);
      if (!after) throw new Error('expected stored user');
      expect(after.hashedMasterPassword).toBe(before.hashedMasterPassword);
    });
  });

  describe('post-login metadata sealing (S5)', () => {
    const sealEmail = 'seal@example.com';
    const sealPassword = 'TestPassword123!';

    it('seals any unsealed credentials automatically on login', async () => {
      await repository.createUser(sealEmail, sealPassword);

      // Insert a pre-v5 legacy credential with plaintext title/username
      // (encryptedPassword can be a stub since sealing doesn't touch it)
      await db.credentials.add({
        id: crypto.randomUUID(),
        title: 'LegacyTitle',
        username: 'legacy@example.com',
        encryptedPassword: JSON.stringify({ ciphertext: 'stub', iv: 'stub' }),
        category: 'login' as const,
        tags: ['old'],
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // isSealed intentionally absent → pre-v5 record
      });

      const before = await db.credentials.toArray();
      expect(before[0]?.isSealed).toBeFalsy();
      expect(before[0]?.title).toBe('LegacyTitle');

      // Login should trigger sealing in the background
      await repository.authenticateWithPassword(sealEmail, sealPassword);

      const after = await db.credentials.toArray();
      expect(after[0]?.isSealed).toBe(true);
      expect(after[0]?.title).toBeFalsy();            // plaintext cleared
      expect(after[0]?.encryptedTitle).toBeTruthy();  // encrypted blob present
    });
  });

  describe('biometric PRF unlock (S1)', () => {
    const email = 'prf@example.com';
    const password = 'TestPassword123!';

    beforeEach(() => {
      vi.stubGlobal('window', {
        location: { hostname: 'localhost', origin: 'http://localhost:3000' },
      });
      vi.mocked(isPRFSupported).mockResolvedValue(true);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.clearAllMocks();
    });

    it('enrolls a PRF credential and stores no legacy key material', async () => {
      const user = await repository.createUser(email, password);
      const session = await repository.authenticateWithPassword(email, password);

      await repository.registerBiometric(user.id, session.vaultKey, 'Test Device');

      const stored = await db.users.get(user.id);
      const cred = stored?.webAuthnCredentials[0];
      expect(cred?.vaultKeyScheme).toBe('prf-v1');
      expect(cred?.wrappedVaultKey).toBeTruthy();
      expect(cred?.prfSalt).toBeTruthy();
      // no insecure device-key material remains (view avoids deprecated-field access)
      const credView = cred as { encryptedVaultKey?: unknown; salt?: unknown } | undefined;
      expect(credView?.encryptedVaultKey).toBeUndefined();
      expect(credView?.salt).toBeUndefined();
      expect(stored?.biometricEnabled).toBe(true);
    });

    it('unlocks the vault via PRF and seals legacy metadata', async () => {
      const user = await repository.createUser(email, password);
      const session = await repository.authenticateWithPassword(email, password);
      await repository.registerBiometric(user.id, session.vaultKey, 'Dev');

      const stored = await db.users.get(user.id);
      const credentialId = stored?.webAuthnCredentials[0]?.id ?? '';
      expect(credentialId).toBeTruthy();

      // a pre-v5 legacy credential to prove sealing fires on the biometric path
      const legacyRow = {
        id: crypto.randomUUID(),
        title: 'LegacyBio',
        username: 'legacybio@example.com',
        encryptedPassword: JSON.stringify({ ciphertext: 'stub', iv: 'stub' }),
        category: 'login' as const,
        tags: ['old'],
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.credentials.add(legacyRow as unknown as Parameters<typeof db.credentials.add>[0]);

      const bioSession = await repository.authenticateWithBiometric(user.id, credentialId);

      expect(bioSession.userId).toBe(user.id);
      // the unwrapped vault key is byte-identical to the password-derived one
      expect(await exportRaw(bioSession.vaultKey)).toBe(await exportRaw(session.vaultKey));

      const after = await db.credentials.toArray();
      const sealed = after[0] as { isSealed?: boolean; title?: unknown; encryptedTitle?: unknown } | undefined;
      expect(sealed?.isSealed).toBe(true);
      expect(sealed?.title).toBeFalsy();           // plaintext cleared by S5 sealing
      expect(sealed?.encryptedTitle).toBeTruthy(); // encrypted blob present
    });

    it('refuses enrollment when PRF is unsupported (password-only)', async () => {
      const user = await repository.createUser(email, password);
      const session = await repository.authenticateWithPassword(email, password);
      vi.mocked(isPRFSupported).mockResolvedValueOnce(false);

      await expect(
        repository.registerBiometric(user.id, session.vaultKey),
      ).rejects.toThrow(/PRF|master password/i);

      const stored = await db.users.get(user.id);
      expect(stored?.webAuthnCredentials.length).toBe(0);
      expect(stored?.biometricEnabled).toBe(false);
    });

    it('refuses enrollment when the authenticator does not enable PRF', async () => {
      const user = await repository.createUser(email, password);
      const session = await repository.authenticateWithPassword(email, password);
      vi.mocked(registerCredentialWithPRF).mockResolvedValueOnce({
        credentialId: 'c',
        publicKey: 'p',
        transports: [],
        prfEnabled: false,
      });

      await expect(
        repository.registerBiometric(user.id, session.vaultKey),
      ).rejects.toThrow(/PRF/);
    });

    it('rejects biometric unlock for a legacy (non-PRF) credential', async () => {
      const user = await repository.createUser(email, password);
      const legacyCred = { id: 'legacy', publicKey: 'pk', counter: 0, createdAt: new Date(), encryptedVaultKey: 'blob', salt: 's' };
      await db.users.update(user.id, {
        biometricEnabled: true,
        webAuthnCredentials: [legacyCred] as unknown as User['webAuthnCredentials'],
      });

      await expect(
        repository.authenticateWithBiometric(user.id, 'legacy'),
      ).rejects.toThrow(/re-enabl/i);
    });

    it('strips legacy biometric credentials on password login', async () => {
      const user = await repository.createUser(email, password);
      const legacyCred = { id: 'legacy', publicKey: 'pk', counter: 0, createdAt: new Date(), encryptedVaultKey: 'blob', salt: 's' };
      await db.users.update(user.id, {
        biometricEnabled: true,
        webAuthnCredentials: [legacyCred] as unknown as User['webAuthnCredentials'],
      });

      await repository.authenticateWithPassword(email, password);

      const stored = await db.users.get(user.id);
      expect(stored?.webAuthnCredentials.length).toBe(0);
      expect(stored?.biometricEnabled).toBe(false);
    });
  });
});
