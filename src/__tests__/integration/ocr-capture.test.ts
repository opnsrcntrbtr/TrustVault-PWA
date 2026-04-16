/**
 * OCR Credential Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseCredentialText, sanitizeValue } from '@/core/ocr/credentialParser';

describe('Credential Parser', () => {
  describe('parseCredentialText', () => {
    it('should extract labeled email/username', () => {
      const text = `
        Username: john.doe@example.com
        Password: SecretPass123!
      `;
      const result = parseCredentialText(text);

      expect(result.username).toBe('john.doe@example.com');
      expect(result.confidence.username).toBeGreaterThan(0.5);
    });

    it('should extract standalone email as username fallback', () => {
      const text = `
        Account details
        Contact: support@domain.org
        Status: Active
      `;
      const result = parseCredentialText(text);

      expect(result.username).toBe('support@domain.org');
      expect(result.confidence.username).toBeGreaterThan(0);
    });

    it('should extract labeled password', () => {
      const text = `
        Email: test@example.com
        Password: MyStr0ngP@ss!
      `;
      const result = parseCredentialText(text);

      expect(result.password).toBe('MyStr0ngP@ss!');
      expect(result.confidence.password).toBeGreaterThan(0.5);
    });

    it('should extract URL', () => {
      const text = `
        Website: https://secure.example.com/login
        User: admin
      `;
      const result = parseCredentialText(text);

      expect(result.url).toBe('https://secure.example.com/login');
      expect(result.confidence.url).toBe(0.8);
    });

    it('should extract www URLs', () => {
      const text = 'Visit www.example.org for more info';
      const result = parseCredentialText(text);

      expect(result.url).toBe('www.example.org');
    });

    it('should handle mixed content', () => {
      const text = `
        Account Information
        -------------------
        Login: admin@company.com
        Pass: Complex123!@#
        Site: https://portal.company.com
        Notes: Primary admin account
      `;
      const result = parseCredentialText(text);

      expect(result.username).toBeDefined();
      expect(result.url).toBe('https://portal.company.com');
    });

    it('should return low confidence when fields not found', () => {
      const text = 'Random text with no credentials';
      const result = parseCredentialText(text);

      expect(result.confidence.overall).toBe(0);
    });

    it('should not extract weak password candidates', () => {
      const text = `
        Password: abc
      `;
      const result = parseCredentialText(text);

      // "abc" is too short and simple to be recognized as password
      expect(result.password).toBeUndefined();
    });

    it('should handle colon-separated labels', () => {
      const text = 'User: testuser\nPassword: TestPass99';
      const result = parseCredentialText(text);

      expect(result.password).toBe('TestPass99');
    });

    it('should handle equals-separated labels', () => {
      const text = 'username = admin\npassword = Admin@123';
      const result = parseCredentialText(text);

      expect(result.password).toBe('Admin@123');
    });
  });

  describe('sanitizeValue', () => {
    it('should remove OCR artifacts', () => {
      expect(sanitizeValue('user|name')).toBe('username');
      expect(sanitizeValue('pass[word]')).toBe('password');
      expect(sanitizeValue('test\\value')).toBe('testvalue');
    });

    it('should collapse multiple spaces', () => {
      expect(sanitizeValue('john    doe')).toBe('john doe');
    });

    it('should trim whitespace', () => {
      expect(sanitizeValue('  email@test.com  ')).toBe('email@test.com');
    });

    it('should handle empty string', () => {
      expect(sanitizeValue('')).toBe('');
    });
  });
});
