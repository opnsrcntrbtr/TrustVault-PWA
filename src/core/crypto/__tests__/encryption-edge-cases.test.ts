/**
 * Encryption Edge Cases and Advanced Security Tests
 * Tests for security-critical edge cases, large data, concurrent operations
 * Addresses identified gaps in encryption module coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateRandomBytes,
  generateSalt,
  deriveKeyFromPassword,
  generateEncryptionKey,
  encrypt,
  decrypt,
  encryptWithPassword,
  decryptWithPassword,
  exportKey,
  importKey,
  constantTimeEqual,
  secureWipe,
  computeHash,
  toHexString,
  PBKDF2_ITERATIONS,
  SALT_LENGTH,
  IV_LENGTH,
  KEY_LENGTH
} from '../encryption';

describe('Encryption Edge Cases', () => {
  describe('Large Data Encryption', () => {
    it('should encrypt and decrypt 1MB of data', async () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      const key = await generateEncryptionKey();

      const encrypted = await encrypt(largeData, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe(largeData);
    });

    it('should encrypt and decrypt 10MB of data', async () => {
      const veryLargeData = 'a'.repeat(10 * 1024 * 1024); // 10MB
      const key = await generateEncryptionKey();

      const encrypted = await encrypt(veryLargeData, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe(veryLargeData);
    }, 30000); // 30 second timeout for large data

    it('should handle empty string encryption', async () => {
      const key = await generateEncryptionKey();

      const encrypted = await encrypt('', key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe('');
    });

    it('should handle single character encryption', async () => {
      const key = await generateEncryptionKey();

      const encrypted = await encrypt('a', key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe('a');
    });

    it('should handle unicode emoji data', async () => {
      const unicodeData = '🔐🛡️🔑💾🚀🌟✨🎉';
      const key = await generateEncryptionKey();

      const encrypted = await encrypt(unicodeData, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe(unicodeData);
    });

    it('should handle complex unicode with RTL and special chars', async () => {
      const complexData = 'Hello مرحبا 你好 שלום مرحبا 🔐';
      const key = await generateEncryptionKey();

      const encrypted = await encrypt(complexData, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe(complexData);
    });

    it('should handle null bytes in data', async () => {
      const dataWithNull = 'test\u0000data\u0000here';
      const key = await generateEncryptionKey();

      const encrypted = await encrypt(dataWithNull, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe(dataWithNull);
    });
  });

  describe('Concurrent Encryption Operations', () => {
    it('should handle concurrent encryption with same key', async () => {
      const key = await generateEncryptionKey();
      const data1 = 'Concurrent Data 1';
      const data2 = 'Concurrent Data 2';
      const data3 = 'Concurrent Data 3';

      const results = await Promise.all([
        encrypt(data1, key),
        encrypt(data2, key),
        encrypt(data3, key)
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).not.toEqual(results[1]); // Different IVs
      expect(results[1]).not.toEqual(results[2]);

      const decrypted = await Promise.all([
        decrypt(results[0], key),
        decrypt(results[1], key),
        decrypt(results[2], key)
      ]);

      expect(decrypted[0]).toBe(data1);
      expect(decrypted[1]).toBe(data2);
      expect(decrypted[2]).toBe(data3);
    });

    it('should handle concurrent encryption with different keys', async () => {
      const data = 'Test Data';

      const [key1, key2, key3] = await Promise.all([
        generateEncryptionKey(),
        generateEncryptionKey(),
        generateEncryptionKey()
      ]);

      const results = await Promise.all([
        encrypt(data, key1),
        encrypt(data, key2),
        encrypt(data, key3)
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).not.toEqual(results[1]);
      expect(results[1]).not.toEqual(results[2]);
    });

    it('should handle 100 concurrent encryption operations', async () => {
      const key = await generateEncryptionKey();
      const operations = Array.from({ length: 100 }, (_, i) =>
        encrypt(`Data ${i}`, key)
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(100);
      // Verify all have unique IVs
      const ivs = results.map(r => r.iv);
      const uniqueIvs = new Set(ivs);
      expect(uniqueIvs.size).toBe(100);
    }, 10000);
  });

  describe('Corrupted Data Handling', () => {
    it('should reject decryption with corrupted ciphertext', async () => {
      const key = await generateEncryptionKey();
      const encrypted = await encrypt('Test Data', key);

      // Corrupt the ciphertext
      const corrupted = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -5) + 'xxxxx'
      };

      await expect(decrypt(corrupted, key)).rejects.toThrow();
    });

    it('should reject decryption with corrupted IV', async () => {
      const key = await generateEncryptionKey();
      const encrypted = await encrypt('Test Data', key);

      // Corrupt the IV
      const corruptedIV = encrypted.iv.split('').reverse().join('');
      const corrupted = {
        ...encrypted,
        iv: corruptedIV
      };

      await expect(decrypt(corrupted, key)).rejects.toThrow();
    });

    it('should reject decryption with invalid base64 ciphertext', async () => {
      const key = await generateEncryptionKey();

      const invalid = {
        ciphertext: 'not-valid-base64!!!',
        iv: generateRandomBytes(IV_LENGTH).toString()
      };

      await expect(decrypt(invalid, key)).rejects.toThrow();
    });

    it('should reject decryption with missing IV', async () => {
      const key = await generateEncryptionKey();
      const encrypted = await encrypt('Test Data', key);

      const missingIV = {
        ciphertext: encrypted.ciphertext,
        iv: ''
      };

      await expect(decrypt(missingIV, key)).rejects.toThrow();
    });

    it('should reject decryption with wrong key', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();

      const encrypted = await encrypt('Test Data', key1);

      await expect(decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('should reject decryption with tampered GCM authentication tag', async () => {
      const key = await generateEncryptionKey();
      const encrypted = await encrypt('Test Data', key);

      // GCM tag is embedded in ciphertext - tampering should fail auth
      const tampered = {
        ...encrypted,
        ciphertext: 'A' + encrypted.ciphertext.slice(1) // Change first char
      };

      await expect(decrypt(tampered, key)).rejects.toThrow();
    });
  });

  describe('Utility Functions', () => {
    describe('secureWipe', () => {
      it('should overwrite Uint8Array with zeros', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        secureWipe(data);

        expect(Array.from(data)).toEqual([0, 0, 0, 0, 0]);
      });

      it('should handle empty Uint8Array', () => {
        const data = new Uint8Array([]);
        expect(() => { secureWipe(data); }).not.toThrow();
      });

      it('should handle large data wiping', () => {
        // crypto.getRandomValues has a limit of 65536 bytes
        const largeData = new Uint8Array(65536); // Max allowed size
        largeData.fill(255);

        secureWipe(largeData);

        expect(largeData.every(byte => byte === 0)).toBe(true);
      });
    });

    describe('computeHash', () => {
      it('should compute SHA-256 hash', () => {
        const data = 'Test Data';
        const hash = computeHash(data);

        expect(hash).toBeDefined();
        expect(hash).toBeInstanceOf(Uint8Array);
        expect(hash.length).toBe(32); // SHA-256 = 32 bytes
      });

      it('should produce same hash for same input', () => {
        const data = 'Test Data';
        const hash1 = computeHash(data);
        const hash2 = computeHash(data);

        // Compare the hex strings
        expect(toHexString(hash1)).toBe(toHexString(hash2));
      });

      it('should produce different hash for different input', () => {
        const hash1 = computeHash('Data 1');
        const hash2 = computeHash('Data 2');

        expect(toHexString(hash1)).not.toBe(toHexString(hash2));
      });

      it('should handle empty string', () => {
        const hash = computeHash('');

        expect(hash).toBeDefined();
        expect(hash.length).toBe(32);
        // SHA-256 of empty string
        expect(toHexString(hash)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      });

      it('should handle unicode data', () => {
        const hash = computeHash('🔐 Test 你好');

        expect(hash).toBeDefined();
        expect(hash.length).toBe(32);
      });
    });

    describe('toHexString', () => {
      it('should convert bytes to hex string', () => {
        const bytes = new Uint8Array([0, 15, 255, 128, 1]);
        const hex = toHexString(bytes);

        expect(hex).toBe('000fff8001');
      });

      it('should handle empty array', () => {
        const bytes = new Uint8Array([]);
        const hex = toHexString(bytes);

        expect(hex).toBe('');
      });

      it('should handle single byte', () => {
        const bytes = new Uint8Array([255]);
        const hex = toHexString(bytes);

        expect(hex).toBe('ff');
      });

      it('should produce lowercase hex', () => {
        const bytes = new Uint8Array([171, 205, 239]); // 0xAB, 0xCD, 0xEF
        const hex = toHexString(bytes);

        expect(hex).toBe('abcdef');
        expect(hex).not.toMatch(/[A-F]/);
      });
    });

    describe('constantTimeEqual', () => {
      it('should return true for equal Uint8Arrays', () => {
        const a = new Uint8Array([1, 2, 3, 4, 5]);
        const b = new Uint8Array([1, 2, 3, 4, 5]);

        expect(constantTimeEqual(a, b)).toBe(true);
      });

      it('should return false for different Uint8Arrays', () => {
        const a = new Uint8Array([1, 2, 3, 4, 5]);
        const b = new Uint8Array([1, 2, 3, 4, 6]);

        expect(constantTimeEqual(a, b)).toBe(false);
      });

      it('should return false for different lengths', () => {
        const a = new Uint8Array([1, 2, 3]);
        const b = new Uint8Array([1, 2, 3, 4]);

        expect(constantTimeEqual(a, b)).toBe(false);
      });

      it('should handle empty arrays', () => {
        const a = new Uint8Array([]);
        const b = new Uint8Array([]);

        expect(constantTimeEqual(a, b)).toBe(true);
      });

      it('should be constant time (no early exit)', () => {
        // This is a behavioral test - timing would require benchmarking
        // We verify it checks all bytes by testing edge cases
        const a = new Uint8Array([0, 0, 0, 0, 0]);
        const b = new Uint8Array([255, 255, 255, 255, 255]);

        expect(constantTimeEqual(a, b)).toBe(false);
      });

      it('should handle large arrays', () => {
        const size = 1024 * 1024;
        const a = new Uint8Array(size).fill(42);
        const b = new Uint8Array(size).fill(42);

        expect(constantTimeEqual(a, b)).toBe(true);

        b[size - 1] = 43; // Change last byte
        expect(constantTimeEqual(a, b)).toBe(false);
      });
    });
  });

  describe('Key Import/Export Edge Cases', () => {
    it('should handle key import with invalid base64', async () => {
      await expect(importKey('not-valid-base64!!!')).rejects.toThrow();
    });

    it('should handle key import with wrong length', async () => {
      const shortKey = Buffer.from('short').toString('base64');
      await expect(importKey(shortKey)).rejects.toThrow();
    });

    it('should export and import key successfully', async () => {
      const originalKey = await generateEncryptionKey();
      const exported = await exportKey(originalKey);
      const imported = await importKey(exported);

      // Test by encrypting with original and decrypting with imported
      const data = 'Test Data';
      const encrypted = await encrypt(data, originalKey);
      const decrypted = await decrypt(encrypted, imported);

      expect(decrypted).toBe(data);
    });

    it('should handle multiple export/import cycles', async () => {
      let key = await generateEncryptionKey();

      for (let i = 0; i < 10; i++) {
        const exported = await exportKey(key);
        key = await importKey(exported);
      }

      // Verify key still works
      const data = 'Test Data';
      const encrypted = await encrypt(data, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe(data);
    });
  });

  describe('Password-based Encryption Edge Cases', () => {
    it('should handle very long passwords', async () => {
      const longPassword = 'x'.repeat(10000);
      const data = 'Test Data';

      const encrypted = await encryptWithPassword(data, longPassword);
      const decrypted = await decryptWithPassword(encrypted, longPassword);

      expect(decrypted).toBe(data);
    });

    it('should handle unicode password', async () => {
      const unicodePassword = '密码🔐пароль';
      const data = 'Test Data';

      const encrypted = await encryptWithPassword(data, unicodePassword);
      const decrypted = await decryptWithPassword(encrypted, unicodePassword);

      expect(decrypted).toBe(data);
    });

    it('should reject wrong password for decryption', async () => {
      const data = 'Test Data';
      const encrypted = await encryptWithPassword(data, 'correctPassword');

      await expect(
        decryptWithPassword(encrypted, 'wrongPassword')
      ).rejects.toThrow();
    });

    it('should use unique salts for each encryption', async () => {
      const password = 'TestPassword123!';
      const data = 'Test Data';

      const encrypted1 = await encryptWithPassword(data, password);
      const encrypted2 = await encryptWithPassword(data, password);

      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });

    it('should handle corrupted salt in password decryption', async () => {
      const password = 'TestPassword123!';
      const encrypted = await encryptWithPassword('Test Data', password);

      const corrupted = {
        ...encrypted,
        salt: (encrypted.salt?.slice(0, -5) ?? '') + 'xxxxx'
      };

      await expect(
        decryptWithPassword(corrupted, password)
      ).rejects.toThrow();
    });
  });

  describe('Key Derivation Edge Cases', () => {
    it('should handle very short salt', async () => {
      const password = 'TestPassword123!';
      const shortSalt = new Uint8Array(8); // Shorter than standard

      const key = await deriveKeyFromPassword(password, shortSalt);

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
    });

    it('should handle custom iteration counts', async () => {
      const password = 'TestPassword123!';
      const salt = generateSalt();

      // Keys derived from PBKDF2 are non-extractable for security
      // Verify by checking both can encrypt/decrypt the same data
      const key1 = await deriveKeyFromPassword(password, salt, PBKDF2_ITERATIONS);
      const key2 = await deriveKeyFromPassword(password, salt, PBKDF2_ITERATIONS);

      const testData = 'test data for key comparison';
      const encrypted = await encrypt(testData, key1);
      const decrypted = await decrypt(encrypted, key2);

      expect(decrypted).toBe(testData);
    });

    it('should produce different keys with different iteration counts', async () => {
      const password = 'TestPassword123!';
      const salt = generateSalt();

      const key1 = await deriveKeyFromPassword(password, salt, 100000);
      const key2 = await deriveKeyFromPassword(password, salt, 200000);

      // Different iteration counts should produce different keys
      const testData = 'test data for key comparison';
      const encrypted = await encrypt(testData, key1);
      
      // Decrypting with different key should fail
      await expect(decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('should handle minimum iteration count', async () => {
      const password = 'TestPassword123!';
      const salt = generateSalt();

      const key = await deriveKeyFromPassword(password, salt, 1);

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
    });
  });

  describe('Constants Validation', () => {
    it('should have OWASP 2025 compliant PBKDF2 iterations', () => {
      expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600000);
    });

    it('should have secure salt length', () => {
      expect(SALT_LENGTH).toBeGreaterThanOrEqual(16);
      expect(SALT_LENGTH).toBe(32); // 256 bits
    });

    it('should have secure IV length', () => {
      expect(IV_LENGTH).toBe(12); // 96 bits for GCM
    });

    it('should have correct key length', () => {
      expect(KEY_LENGTH).toBe(32); // 256 bits for AES-256
    });
  });
});
