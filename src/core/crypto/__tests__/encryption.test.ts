/**
 * Encryption Tests
 * Tests AES-256-GCM encryption and PBKDF2 key derivation
 * Phase 0 & Phase 1 validation
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
  PBKDF2_ITERATIONS,
  SALT_LENGTH,
  IV_LENGTH,
  KEY_LENGTH
} from '../encryption';

describe('Encryption Core', () => {
  describe('Random Number Generation', () => {
    it('should generate random bytes of specified length', () => {
      const bytes = generateRandomBytes(32);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
    });

    it('should generate different random bytes on each call', () => {
      const bytes1 = generateRandomBytes(32);
      const bytes2 = generateRandomBytes(32);
      expect(bytes1).not.toEqual(bytes2);
    });

    it('should generate salt of correct length', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(SALT_LENGTH);
    });
  });

  describe('Key Derivation (PBKDF2)', () => {
    it('should derive key from password with correct parameters', async () => {
      const password = 'TestPassword123!';
      const salt = generateSalt();
      
      const key = await deriveKeyFromPassword(password, salt);
      
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should derive same key from same password and salt', async () => {
      const password = 'TestPassword123!';
      const salt = generateSalt();
      
      const key1 = await deriveKeyFromPassword(password, salt);
      const key2 = await deriveKeyFromPassword(password, salt);
      
      // Keys derived from PBKDF2 are non-extractable for security
      // Verify by checking both can encrypt/decrypt the same data
      const testData = 'test data for key comparison';
      const encrypted = await encrypt(testData, key1);
      const decrypted = await decrypt(encrypted, key2);
      
      expect(decrypted).toBe(testData);
    });

    it('should derive different keys from different passwords', async () => {
      const salt = generateSalt();
      
      const key1 = await deriveKeyFromPassword('Password1', salt);
      const key2 = await deriveKeyFromPassword('Password2', salt);
      
      // Encrypt with key1, try to decrypt with key2 (should fail)
      const testData = 'test data for key comparison';
      const encrypted = await encrypt(testData, key1);
      
      await expect(decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('should derive different keys from different salts', async () => {
      const password = 'TestPassword123!';
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      
      const key1 = await deriveKeyFromPassword(password, salt1);
      const key2 = await deriveKeyFromPassword(password, salt2);
      
      // Encrypt with key1, try to decrypt with key2 (should fail)
      const testData = 'test data for key comparison';
      const encrypted = await encrypt(testData, key1);
      
      await expect(decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('should use OWASP-compliant iteration count', () => {
      expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600000);
    });
  });

  describe('Key Generation', () => {
    it('should generate AES-256-GCM key', async () => {
      const key = await generateEncryptionKey();
      
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should generate different keys on each call', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();
      
      const exported1 = await exportKey(key1);
      const exported2 = await exportKey(key2);
      
      expect(exported1).not.toBe(exported2);
    });
  });

  describe('Encryption/Decryption', () => {
    let key: CryptoKey;

    beforeEach(async () => {
      key = await generateEncryptionKey();
    });

    it('should encrypt plaintext to ciphertext with IV', async () => {
      const plaintext = 'sensitive data';
      
      const encrypted = await encrypt(plaintext, key);
      
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.ciphertext).not.toBe(plaintext);
    });

    it('should decrypt ciphertext back to plaintext', async () => {
      const plaintext = 'sensitive data';
      
      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';
      
      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters and unicode', async () => {
      const plaintext = 'Test™ 日本語 🔐 émojis!@#$%^&*()';
      
      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long texts', async () => {
      const plaintext = 'a'.repeat(10000);
      
      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should generate unique IV for each encryption', async () => {
      const plaintext = 'same text';
      
      const encrypted1 = await encrypt(plaintext, key);
      const encrypted2 = await encrypt(plaintext, key);
      
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });

    it('should fail decryption with wrong key', async () => {
      const plaintext = 'sensitive data';
      const wrongKey = await generateEncryptionKey();
      
      const encrypted = await encrypt(plaintext, key);
      
      await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
    });

    it('should fail decryption with tampered ciphertext', async () => {
      const plaintext = 'sensitive data';
      
      const encrypted = await encrypt(plaintext, key);
      const tampered = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -4) + 'AAAA'
      };
      
      await expect(decrypt(tampered, key)).rejects.toThrow();
    });
  });

  describe('Password-Based Encryption', () => {
    it('should encrypt with password', async () => {
      const plaintext = 'sensitive data';
      const password = 'SecurePassword123!';
      
      const encrypted = await encryptWithPassword(plaintext, password);
      
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
    });

    it('should decrypt with correct password', async () => {
      const plaintext = 'sensitive data';
      const password = 'SecurePassword123!';
      
      const encrypted = await encryptWithPassword(plaintext, password);
      const decrypted = await decryptWithPassword(encrypted, password);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with wrong password', async () => {
      const plaintext = 'sensitive data';
      const password = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      
      const encrypted = await encryptWithPassword(plaintext, password);
      
      await expect(decryptWithPassword(encrypted, wrongPassword)).rejects.toThrow();
    });

    it('should require salt for decryption', async () => {
      const plaintext = 'sensitive data';
      const password = 'SecurePassword123!';
      
      const encrypted = await encryptWithPassword(plaintext, password);
      const noSalt: { ciphertext: string; iv: string; authTag?: string | undefined; salt?: string | undefined } = { ...encrypted, salt: undefined };
      
      await expect(decryptWithPassword(noSalt, password)).rejects.toThrow('Salt is required');
    });
  });

  describe('Key Import/Export', () => {
    it('should export key to base64 string', async () => {
      const key = await generateEncryptionKey();
      
      const exported = await exportKey(key);
      
      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThan(0);
    });

    it('should import key from base64 string', async () => {
      const originalKey = await generateEncryptionKey();
      const exported = await exportKey(originalKey);
      
      const importedKey = await importKey(exported);
      
      expect(importedKey).toBeDefined();
      expect(importedKey.type).toBe('secret');
      expect(importedKey.algorithm.name).toBe('AES-GCM');
    });

    it('should maintain key functionality after export/import', async () => {
      const plaintext = 'test data';
      const originalKey = await generateEncryptionKey();
      
      const encrypted = await encrypt(plaintext, originalKey);
      
      const exported = await exportKey(originalKey);
      const importedKey = await importKey(exported);
      
      const decrypted = await decrypt(encrypted, importedKey);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Constant-Time Comparison', () => {
    it('should return true for equal arrays', () => {
      const arr1 = new Uint8Array([1, 2, 3, 4, 5]);
      const arr2 = new Uint8Array([1, 2, 3, 4, 5]);
      
      expect(constantTimeEqual(arr1, arr2)).toBe(true);
    });

    it('should return false for different arrays', () => {
      const arr1 = new Uint8Array([1, 2, 3, 4, 5]);
      const arr2 = new Uint8Array([1, 2, 3, 4, 6]);
      
      expect(constantTimeEqual(arr1, arr2)).toBe(false);
    });

    it('should return false for arrays of different lengths', () => {
      const arr1 = new Uint8Array([1, 2, 3]);
      const arr2 = new Uint8Array([1, 2, 3, 4]);
      
      expect(constantTimeEqual(arr1, arr2)).toBe(false);
    });

    it('should handle empty arrays', () => {
      const arr1 = new Uint8Array([]);
      const arr2 = new Uint8Array([]);
      
      expect(constantTimeEqual(arr1, arr2)).toBe(true);
    });
  });

  describe('Security Parameters', () => {
    it('should use correct salt length (256 bits)', () => {
      expect(SALT_LENGTH).toBe(32);
    });

    it('should use correct IV length for GCM (96 bits)', () => {
      expect(IV_LENGTH).toBe(12);
    });

    it('should use correct key length (256 bits)', () => {
      expect(KEY_LENGTH).toBe(32);
    });
  });
});
