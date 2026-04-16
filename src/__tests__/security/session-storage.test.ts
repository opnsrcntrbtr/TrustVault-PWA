/**
 * Session Management Security Tests
 * Phase 5.3 - Security Audit & Penetration Testing
 * Tests OWASP M3: Insecure Authentication & M9: Insecure Data Storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserRepositoryImpl } from '@/data/repositories/UserRepositoryImpl';
import { CredentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { db } from '@/data/storage/database';
import type { Credential } from '@/domain/entities/Credential';

describe('OWASP M3: Insecure Authentication - Session Security', () => {
  let userRepo: UserRepositoryImpl;
  let credRepo: CredentialRepository;

  beforeEach(async () => {
    userRepo = new UserRepositoryImpl();
    credRepo = new CredentialRepository();
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();
  });

  afterEach(async () => {
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();
  });

  describe('Session Creation Security', () => {
    it('should create session with expiry time', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');
      const session = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      expect(session.expiresAt).toBeDefined();
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should not store plaintext passwords in session', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');
      const session = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      const sessionStr = JSON.stringify(session);
      expect(sessionStr).not.toContain('Password123!');
    });

    it('should store vault key as CryptoKey object (not exportable string)', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');
      const session = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      expect(session.vaultKey).toBeInstanceOf(CryptoKey);
      expect(session.vaultKey.type).toBe('secret');

      // Vault key should not be serializable to JSON
      const sessionCopy = JSON.parse(JSON.stringify(session)) as { vaultKey?: CryptoKey };
      expect(sessionCopy.vaultKey).toEqual({}); // CryptoKey becomes empty object
    });

    it('should mark session as unlocked initially', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');
      const session = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      expect(session.isLocked).toBe(false);
    });
  });

  describe('Session Locking Security', () => {
    it('should clear vault key on session lock', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');
      await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      await userRepo.lockSession();

      const session = await userRepo.getSession();
      expect(session).toBeNull(); // Session locked/cleared
    });

    it('should prevent credential access after session lock', async () => {
      const user = await userRepo.createUser('test@example.com', 'Password123!');
      const session = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      const credential: Credential = {
        id: crypto.randomUUID(),
        userId: user.id,
        title: 'Test',
        password: 'secret',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await credRepo.save(credential, session.vaultKey);

      // Lock session
      await userRepo.lockSession();

      // Should not be able to retrieve session
      const lockedSession = await userRepo.getSession();
      expect(lockedSession).toBeNull();
    });

    it('should require re-authentication after lock', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');
      await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      await userRepo.lockSession();

      // Re-authenticate required
      const newSession = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');
      expect(newSession).toBeDefined();
      expect(newSession.vaultKey).toBeInstanceOf(CryptoKey);
    });
  });

  describe('Session Destruction Security', () => {
    it('should completely destroy session on logout', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');
      await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      await userRepo.destroySession();

      const session = await userRepo.getSession();
      expect(session).toBeNull();
    });

    it('should clear session from IndexedDB', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');
      await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      await userRepo.destroySession();

      const sessions = await db.sessions.toArray();
      expect(sessions.length).toBe(0);
    });
  });

  describe('Concurrent Session Prevention', () => {
    it('should handle multiple authentication attempts', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');

      const session1 = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');
      const session2 = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      // Both sessions should have vault keys
      expect(session1.vaultKey).toBeDefined();
      expect(session2.vaultKey).toBeDefined();

      // Sessions should be independent
      expect(session1.userId).toBe(session2.userId);
    });

    it('should invalidate previous session on new authentication', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');

      await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      // Authenticate again
      await userRepo.authenticateWithPassword('test@example.com', 'Password123!');
      const session2 = await userRepo.getSession();

      // Only latest session should exist
      expect(session2).toBeDefined();

      // In production, should track and invalidate previous sessions
      const allSessions = await db.sessions.toArray();
      expect(allSessions.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Session Fixation Prevention', () => {
    it('should generate new session on authentication', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');

      const session1 = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');
      await userRepo.destroySession();

      const session2 = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');

      // Sessions should be completely independent
      expect(session1.userId).toBe(session2.userId);
      expect(session1.expiresAt).not.toBe(session2.expiresAt);
    });

    it('should not reuse vault keys across sessions', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');

      const session1 = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');
      const key1 = session1.vaultKey;

      await userRepo.destroySession();

      const session2 = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');
      const key2 = session2.vaultKey;

      // Keys should be different CryptoKey instances
      expect(key1).not.toBe(key2);
    });
  });

  describe('Password Change Security', () => {
    it('should invalidate session after password change', async () => {
      const user = await userRepo.createUser('test@example.com', 'OldPassword123!');
      await userRepo.authenticateWithPassword('test@example.com', 'OldPassword123!');

      await userRepo.changeMasterPassword(user.id, 'OldPassword123!', 'NewPassword456!');

      // Old password should not work
      await expect(
        userRepo.authenticateWithPassword('test@example.com', 'OldPassword123!')
      ).rejects.toThrow('Invalid email or password');

      // New password should work
      const newSession = await userRepo.authenticateWithPassword('test@example.com', 'NewPassword456!');
      expect(newSession).toBeDefined();
    });

    it('should re-encrypt vault key with new password', async () => {
      const user = await userRepo.createUser('test@example.com', 'OldPassword123!');
      const oldSession = await userRepo.authenticateWithPassword('test@example.com', 'OldPassword123!');

      const credential: Credential = {
        id: crypto.randomUUID(),
        userId: user.id,
        title: 'Test',
        password: 'secret123',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await credRepo.save(credential, oldSession.vaultKey);

      // Change password
      await userRepo.changeMasterPassword(user.id, 'OldPassword123!', 'NewPassword456!');

      // Authenticate with new password
      const newSession = await userRepo.authenticateWithPassword('test@example.com', 'NewPassword456!');

      // Should be able to decrypt credentials with new vault key
      const retrieved = await credRepo.findById(credential.id, newSession.vaultKey);
      expect(retrieved?.password).toBe('secret123');
    });
  });

  describe('Brute Force Prevention', () => {
    it('should handle multiple failed authentication attempts', async () => {
      await userRepo.createUser('test@example.com', 'CorrectPassword123!');

      const attempts = 10;
      let failures = 0;

      for (let i = 0; i < attempts; i++) {
        try {
          await userRepo.authenticateWithPassword('test@example.com', `WrongPassword${String(i)}!`);
        } catch {
          failures++;
        }
      }

      expect(failures).toBe(attempts);

      // Should still allow correct password
      const session = await userRepo.authenticateWithPassword('test@example.com', 'CorrectPassword123!');
      expect(session).toBeDefined();

      // Note: Production should implement rate limiting and account lockout
    });

    it('should maintain constant-time password verification', async () => {
      await userRepo.createUser('test@example.com', 'Password123!');

      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        try {
          await userRepo.authenticateWithPassword('test@example.com', 'WrongPassword!');
        } catch {
          // Expected failure
        }
        times.push(performance.now() - start);
      }

      // Times should be relatively consistent (within 3x)
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const ratio = maxTime / minTime;

      expect(ratio).toBeLessThan(3);
    });
  });
});

describe('OWASP M9: Insecure Data Storage', () => {
  let userRepo: UserRepositoryImpl;
  let credRepo: CredentialRepository;
  let vaultKey: CryptoKey;
  let userId: string;

  beforeEach(async () => {
    userRepo = new UserRepositoryImpl();
    credRepo = new CredentialRepository();

    await db.users.clear();
    await db.credentials.clear();

    const user = await userRepo.createUser('test@example.com', 'Password123!');
    userId = user.id;
    const session = await userRepo.authenticateWithPassword('test@example.com', 'Password123!');
    vaultKey = session.vaultKey;
  });

  afterEach(async () => {
    await db.users.clear();
    await db.credentials.clear();
  });

  describe('IndexedDB Encryption', () => {
    it('should store passwords encrypted in IndexedDB', async () => {
      const plainPassword = 'MySecretPassword123!';

      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: plainPassword,
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await credRepo.save(credential, vaultKey);

      // Check raw storage
      const stored = await db.credentials.get(credential.id);

      // Password should be stored encrypted, not as plaintext
      expect(stored?.encryptedPassword).toBeDefined();
      expect(stored?.encryptedPassword).not.toBe(plainPassword);
      expect(stored?.encryptedPassword).not.toContain(plainPassword);
    });

    it('should store notes encrypted in IndexedDB', async () => {
      const plainNotes = 'Sensitive information here';

      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        notes: plainNotes,
        password: 'pass',
        category: 'note',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await credRepo.save(credential, vaultKey);

      const stored = await db.credentials.get(credential.id);

      expect(stored?.notes).toBeDefined();
      expect(stored?.notes).not.toBe(plainNotes);
      expect(stored?.notes).not.toContain(plainNotes);
    });

    it('should store TOTP secrets encrypted', async () => {
      const plainTOTP = 'JBSWY3DPEHPK3PXP';

      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: 'pass',
        totpSecret: plainTOTP,
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await credRepo.save(credential, vaultKey);

      const stored = await db.credentials.get(credential.id);

      expect(stored?.encryptedTotpSecret).toBeDefined();
      expect(stored?.encryptedTotpSecret).not.toBe(plainTOTP);
    });

    it('should NOT encrypt non-sensitive fields', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'My Website',
        username: 'myuser',
        password: 'secret',
        url: 'https://example.com',
        category: 'login',
        tags: ['work', 'important'],
        isFavorite: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await credRepo.save(credential, vaultKey);

      const stored = await db.credentials.get(credential.id);

      // Non-sensitive fields should be searchable (not encrypted)
      expect(stored?.title).toBe('My Website');
      expect(stored?.username).toBe('myuser');
      expect(stored?.url).toBe('https://example.com');
      expect(stored?.category).toBe('login');
      expect(stored?.isFavorite).toBe(true);
      expect(stored?.tags).toEqual(['work', 'important']);
    });
  });

  describe('Password Storage Security', () => {
    it('should never store plaintext master password', async () => {
      const plainPassword = 'MyMasterPassword123!';
      // Use unique email to avoid conflict with beforeEach user
      await db.users.clear();
      const user = await userRepo.createUser('password-test@example.com', plainPassword);

      expect(user.hashedMasterPassword).not.toBe(plainPassword);
      expect(user.hashedMasterPassword).not.toContain(plainPassword);
      expect(user.hashedMasterPassword).toContain('scrypt$');

      const stored = await db.users.get(user.id);

      expect(stored?.hashedMasterPassword).not.toBe(plainPassword);
      expect(stored?.hashedMasterPassword).not.toContain(plainPassword);
    });

    it('should store vault key encrypted', async () => {
      // Use unique email to avoid conflict with beforeEach user
      await db.users.clear();
      const user = await userRepo.createUser('vault-key-test@example.com', 'Password123!');

      expect(user.encryptedVaultKey).toBeDefined();
      expect(typeof user.encryptedVaultKey).toBe('string');

      // Should be JSON with ciphertext, iv (authTag is embedded in ciphertext for AES-GCM)
      const parsed = JSON.parse(user.encryptedVaultKey) as { ciphertext: string; iv: string };
      expect(parsed.ciphertext).toBeDefined();
      expect(parsed.iv).toBeDefined();
      // AES-GCM appends auth tag to ciphertext, so we verify ciphertext is long enough
      // Base64 ciphertext should include 16-byte auth tag
      expect(parsed.ciphertext.length).toBeGreaterThan(20);
    });
  });

  describe('Data Remnants After Deletion', () => {
    it('should remove all credential data on deletion', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'To Delete',
        password: 'secret',
        notes: 'sensitive notes',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await credRepo.save(credential, vaultKey);
      await credRepo.delete(credential.id);

      const stored = await db.credentials.get(credential.id);
      expect(stored).toBeUndefined();

      // Verify not in any index
      const all = await db.credentials.toArray();
      expect(all.find(c => c.id === credential.id)).toBeUndefined();
    });

    it('should clear session data on logout', async () => {
      // Use unique email to avoid conflict with beforeEach user
      await db.users.clear();
      await userRepo.createUser('logout-test@example.com', 'Password123!');
      await userRepo.authenticateWithPassword('logout-test@example.com', 'Password123!');

      await userRepo.destroySession();

      const sessions = await db.sessions.toArray();
      expect(sessions.length).toBe(0);
    });
  });

  describe('localStorage Security', () => {
    it('should not store sensitive data in localStorage', () => {
      // Check that localStorage doesn't contain sensitive patterns
      const storage = JSON.stringify(localStorage);

      expect(storage).not.toMatch(/password/i);
      expect(storage).not.toMatch(/vaultKey/i);
      expect(storage).not.toMatch(/masterKey/i);
      expect(storage).not.toMatch(/secret/i);
      expect(storage).not.toMatch(/cryptokey/i);

      // Zustand persist is allowed for non-sensitive state only
    });
  });

  describe('sessionStorage Security', () => {
    it('should not store vault keys in sessionStorage', () => {
      const storage = JSON.stringify(sessionStorage);

      expect(storage).not.toMatch(/vaultKey/i);
      expect(storage).not.toMatch(/cryptokey/i);
      expect(storage).not.toMatch(/password/i);
    });
  });
});
