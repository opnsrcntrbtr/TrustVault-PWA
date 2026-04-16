/**
 * UserRepository Implementation Tests
 * Tests user creation, authentication, and management with IndexedDB
 * Phase 5.1 - Repository tests (90% coverage target)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserRepositoryImpl } from '../UserRepositoryImpl';
import { db } from '../../storage/database';
import type { User } from '@/domain/entities/User';

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
});
