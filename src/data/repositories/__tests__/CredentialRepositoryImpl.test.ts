/**
 * CredentialRepository Implementation Tests
 * Tests credential CRUD operations with encryption and IndexedDB
 * Phase 5.1 - Repository tests (90% coverage target)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialRepository } from '../CredentialRepositoryImpl';
import { UserRepositoryImpl } from '../UserRepositoryImpl';
import { db } from '../../storage/database';
import type { Credential } from '@/domain/entities/Credential';

describe('CredentialRepositoryImpl', () => {
  let repository: CredentialRepository;
  let userRepository: UserRepositoryImpl;
  let vaultKey: CryptoKey;
  let userId: string;

  beforeEach(async () => {
    repository = new CredentialRepository();
    userRepository = new UserRepositoryImpl();

    // Clear database
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();

    // Create test user and get vault key
    const user = await userRepository.createUser('test@example.com', 'TestPassword123!');
    userId = user.id;

    const session = await userRepository.authenticateWithPassword('test@example.com', 'TestPassword123!');
    vaultKey = session.vaultKey;
  });

  afterEach(async () => {
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();
  });

  describe('save()', () => {
    it('should save a new credential', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecretPassword123!',
        website: 'https://gmail.com',
        notes: 'My email account',
        category: 'login',
        tags: ['email', 'google'],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      const saved = await repository.save(credential, vaultKey, userId);

      expect(saved).toBeDefined();
      expect(saved.id).toBe(credential.id);
      expect(saved.title).toBe(credential.title);
    });

    it('should encrypt password field', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test Site',
        username: 'testuser',
        password: 'MySecretPassword123!',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      // Check encrypted storage - the field is encryptedPassword, not password
      const stored = await db.credentials.get(credential.id);

      expect(stored).toBeDefined();
      expect(stored?.encryptedPassword).not.toBe('MySecretPassword123!');
      expect(stored?.encryptedPassword).toBeTruthy();
    });

    it('should encrypt notes field', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: 'password',
        notes: 'Sensitive notes here',
        category: 'note',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const stored = await db.credentials.get(credential.id);

      // S5: notes are stored in encryptedNotes (AES-256-GCM), never in the
      // legacy plaintext notes column.
      expect(stored?.notes).toBeFalsy();
      expect(stored?.encryptedNotes).toBeTruthy();
      expect(stored?.encryptedNotes).not.toBe('Sensitive notes here');
    });

    it('should handle credentials without password', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Secure Note',
        notes: 'Just a note',
        category: 'note',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      const saved = await repository.save(credential, vaultKey, userId);

      expect(saved).toBeDefined();
      // save() now returns the fully round-tripped record (create → decrypt).
      // An absent password encrypts as the empty string and decrypts back as ''.
      // Both '' and undefined are falsy; the credential must not expose a real secret.
      expect(saved.password).toBeFalsy();
    });

    it('should handle credentials without notes', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Simple Login',
        username: 'user',
        password: 'pass',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      const saved = await repository.save(credential, vaultKey, userId);

      expect(saved).toBeDefined();
      expect(saved.notes).toBeUndefined();
    });

    it('should update existing credential', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Original Title',
        password: 'OriginalPass',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      // Update credential
      const updated = { ...credential, title: 'Updated Title', password: 'UpdatedPass' };
      await repository.save(updated, vaultKey, userId);

      const retrieved = await repository.findById(credential.id, vaultKey, userId);

      expect(retrieved?.title).toBe('Updated Title');
      expect(retrieved?.password).toBe('UpdatedPass');
    });

    it('should preserve tags', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Tagged Cred',
        password: 'pass',
        category: 'login',
        tags: ['work', 'important', 'finance'],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const retrieved = await repository.findById(credential.id, vaultKey, userId);

      expect(retrieved?.tags).toEqual(['work', 'important', 'finance']);
    });

    it('should preserve favorite status', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Favorite',
        password: 'pass',
        category: 'login',
        tags: [],
        isFavorite: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const retrieved = await repository.findById(credential.id, vaultKey, userId);

      expect(retrieved?.isFavorite).toBe(true);
    });

    it('should handle TOTP secret encryption', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'With TOTP',
        password: 'pass',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const stored = await db.credentials.get(credential.id);

      // Check encrypted storage - the field is encryptedTotpSecret, not totpSecret
      expect(stored?.encryptedTotpSecret).not.toBe('JBSWY3DPEHPK3PXP');
      expect(stored?.encryptedTotpSecret).toBeTruthy();

      const retrieved = await repository.findById(credential.id, vaultKey, userId);

      expect(retrieved?.totpSecret).toBe('JBSWY3DPEHPK3PXP');
    });
  });

  describe('findById()', () => {
    it('should find credential by ID', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test Credential',
        password: 'password',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const found = await repository.findById(credential.id, vaultKey, userId);

      expect(found).toBeDefined();
      expect(found?.id).toBe(credential.id);
      expect(found?.title).toBe('Test Credential');
    });

    it('should decrypt password', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: 'MySecretPassword123!',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const found = await repository.findById(credential.id, vaultKey, userId);

      expect(found?.password).toBe('MySecretPassword123!');
    });

    it('should decrypt notes', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: 'pass',
        notes: 'Secret notes here',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const found = await repository.findById(credential.id, vaultKey, userId);

      expect(found?.notes).toBe('Secret notes here');
    });

    it('should return null for non-existent ID', async () => {
      const found = await repository.findById('non-existent-id', vaultKey, userId);

      expect(found).toBeNull();
    });

    it('should fail with wrong vault key', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: 'password',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      // Create another user with different vault key
      const anotherUser = await userRepository.createUser('another@example.com', 'Password123!');
      const anotherSession = await userRepository.authenticateWithPassword('another@example.com', 'Password123!');

      // v9 per-user partitioning: another user cannot even see the row —
      // findById returns null instead of a [Decryption Failed] placeholder.
      const result = await repository.findById(credential.id, anotherSession.vaultKey, anotherUser.id);
      expect(result).toBeNull();
    });
  });

  describe('findAll()', () => {
    it('should return empty array when no credentials exist', async () => {
      const credentials = await repository.findAll(vaultKey, userId);

      expect(credentials).toEqual([]);
    });

    it('should return all credentials for user', async () => {
      const cred1: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Credential 1',
        password: 'pass1',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      const cred2: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Credential 2',
        password: 'pass2',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(cred1, vaultKey, userId);
      await repository.save(cred2, vaultKey, userId);

      const credentials = await repository.findAll(vaultKey, userId);

      expect(credentials.length).toBe(2);
      expect(credentials.map(c => c.title)).toContain('Credential 1');
      expect(credentials.map(c => c.title)).toContain('Credential 2');
    });

    it('should decrypt all passwords', async () => {
      const cred1: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Cred 1',
        password: 'SecretPass1',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      const cred2: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Cred 2',
        password: 'SecretPass2',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(cred1, vaultKey, userId);
      await repository.save(cred2, vaultKey, userId);

      const credentials = await repository.findAll(vaultKey, userId);

      // Don't rely on order - just check both passwords exist
      const passwords = credentials.map(c => c.password);
      expect(passwords).toContain('SecretPass1');
      expect(passwords).toContain('SecretPass2');
    });

    it('should only return credentials for current user', async () => {
      // v9: rows are partitioned by userId at the repository layer, in
      // addition to the per-user vault-key encryption isolation.
      
      // Create credential for first user
      const cred1: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'User 1 Credential',
        password: 'pass1',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(cred1, vaultKey, userId);

      // Create second user and credential
      const user2 = await userRepository.createUser('user2@example.com', 'Password123!');
      const session2 = await userRepository.authenticateWithPassword('user2@example.com', 'Password123!');

      const cred2: Credential = {
        id: crypto.randomUUID(),
        userId: user2.id,
        title: 'User 2 Credential',
        password: 'pass2',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(cred2, session2.vaultKey, user2.id);

      // Get credentials using first user's key
      const user1Credentials = await repository.findAll(vaultKey, userId);
      
      // Both credentials exist but only the ones encrypted with this key decrypt properly
      // Credentials encrypted with different key will show [Decryption Failed]
      const decryptableCredentials = user1Credentials.filter(c => c.password !== '[Decryption Failed]');
      expect(decryptableCredentials.length).toBe(1);
      expect(decryptableCredentials[0]?.title).toBe('User 1 Credential');
    });
  });

  describe('delete()', () => {
    it('should delete credential by ID', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'To Delete',
        password: 'pass',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      await repository.delete(credential.id, userId);

      const found = await repository.findById(credential.id, vaultKey, userId);

      expect(found).toBeNull();
    });

    it('should throw "Credential not found" for non-existent ID (v9: same message as not-owned, no existence oracle)', async () => {
      await expect(repository.delete('non-existent-id', userId)).rejects.toThrow(
        'Credential not found'
      );
    });

    it('should not affect other credentials', async () => {
      const cred1: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Keep This',
        password: 'pass1',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      const cred2: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Delete This',
        password: 'pass2',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(cred1, vaultKey, userId);
      await repository.save(cred2, vaultKey, userId);

      await repository.delete(cred2.id, userId);

      const remaining = await repository.findAll(vaultKey, userId);

      expect(remaining.length).toBe(1);
      expect(remaining[0]?.title).toBe('Keep This');
    });
  });

  describe('updateAccessTime()', () => {
    it('should update lastAccessedAt timestamp', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: 'pass',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(Date.now() - 10000), // 10 seconds ago
      };

      await repository.save(credential, vaultKey, userId);

      const beforeUpdate = Date.now();
      await repository.updateAccessTime(credential.id, userId);
      const afterUpdate = Date.now();

      const updated = await repository.findById(credential.id, vaultKey, userId);

      expect(updated?.lastAccessedAt).toBeDefined();
      expect(updated!.lastAccessedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
      expect(updated!.lastAccessedAt.getTime()).toBeLessThanOrEqual(afterUpdate);
    });

    it('should not throw error for non-existent ID', async () => {
      await expect(repository.updateAccessTime('non-existent-id', userId)).resolves.not.toThrow();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle special characters in password', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: 'P@ssw0rd!#$%^&*()_+-=[]{}|;:\'",.<>?/~`',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const retrieved = await repository.findById(credential.id, vaultKey, userId);

      expect(retrieved?.password).toBe('P@ssw0rd!#$%^&*()_+-=[]{}|;:\'",.<>?/~`');
    });

    it('should handle unicode in password', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: 'Pass你好🔐Word',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const retrieved = await repository.findById(credential.id, vaultKey, userId);

      expect(retrieved?.password).toBe('Pass你好🔐Word');
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'P@ssw0rd' + 'a'.repeat(1000);
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: longPassword,
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const retrieved = await repository.findById(credential.id, vaultKey, userId);

      expect(retrieved?.password).toBe(longPassword);
      expect(retrieved?.password?.length).toBe(1008);
    }, 30000); // 30 second timeout for long password encryption

    it('should handle many tags', async () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        password: 'pass',
        category: 'login',
        tags: manyTags,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const retrieved = await repository.findById(credential.id, vaultKey, userId);

      expect(retrieved?.tags).toEqual(manyTags);
      expect(retrieved?.tags.length).toBe(50);
    });

    it('should handle empty string values', async () => {
      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: '',
        username: '',
        password: '',
        website: '',
        notes: '',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await repository.save(credential, vaultKey, userId);

      const retrieved = await repository.findById(credential.id, vaultKey, userId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('');
    });
  });
});
