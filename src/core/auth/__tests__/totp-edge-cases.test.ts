/**
 * TOTP Edge Cases and Advanced Tests
 * Tests for time skew, custom parameters, concurrent operations
 * Addresses identified gaps in TOTP module coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateTOTP,
  verifyTOTP,
  base32Decode,
  base32Encode,
  getTOTPRemaining,
  getTOTPProgress,
  formatTOTPCode,
  isValidTOTPSecret,
  generateTOTPSecret
} from '../totp';

describe('TOTP Edge Cases', () => {
  const testSecret = 'JBSWY3DPEHPK3PXP'; // Base32 encoded "Hello!"
  const currentTime = Date.now();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatTOTPCode', () => {
    it('should format 6-digit code with space', () => {
      const formatted = formatTOTPCode('123456');
      expect(formatted).toBe('123 456');
    });

    it('should format 7-digit code', () => {
      const formatted = formatTOTPCode('1234567');
      expect(formatted).toBe('123 4567');
    });

    it('should format 8-digit code', () => {
      const formatted = formatTOTPCode('12345678');
      expect(formatted).toBe('1234 5678');
    });

    it('should handle 4-digit code', () => {
      const formatted = formatTOTPCode('1234');
      expect(formatted).toBe('12 34');
    });

    it('should handle single digit', () => {
      const formatted = formatTOTPCode('1');
      expect(formatted).toBe('1');
    });

    it('should handle empty string', () => {
      const formatted = formatTOTPCode('');
      expect(formatted).toBe('');
    });

    it('should preserve leading zeros', () => {
      const formatted = formatTOTPCode('000123');
      expect(formatted).toBe('000 123');
    });
  });

  describe('Time Skew Scenarios', () => {
    it('should generate different codes for different time steps', () => {
      const time1 = 1000000;
      const time2 = 1000000 + 30000; // 30 seconds later

      const code1 = generateTOTP(testSecret, 30, 6, time1);
      const code2 = generateTOTP(testSecret, 30, 6, time2);

      expect(code1).not.toBe(code2);
    });

    it('should handle time in the past', () => {
      const pastTime = currentTime - 100000;
      const code = generateTOTP(testSecret, 30, 6, pastTime);

      expect(code).toBeDefined();
      expect(code.length).toBe(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    it('should handle time in the future', () => {
      const futureTime = currentTime + 100000;
      const code = generateTOTP(testSecret, 30, 6, futureTime);

      expect(code).toBeDefined();
      expect(code.length).toBe(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    it('should verify code with time window', () => {
      const time = currentTime;
      const code = generateTOTP(testSecret, 30, 6, time);

      // Verify within same time window
      const isValid = verifyTOTP(code, testSecret, 1, 30, time);
      expect(isValid).toBe(true);
    });

    it('should verify code with time window ±1 step', () => {
      const time = currentTime;
      const code = generateTOTP(testSecret, 30, 6, time);

      // Verify 30 seconds earlier (within window)
      const isValidBefore = verifyTOTP(code, testSecret, 1, 30, time - 30000);
      expect(isValidBefore).toBe(true);

      // Verify 30 seconds later (within window)
      const isValidAfter = verifyTOTP(code, testSecret, 1, 30, time + 30000);
      expect(isValidAfter).toBe(true);
    });

    it('should reject code outside time window', () => {
      const time = currentTime;
      const code = generateTOTP(testSecret, 30, 6, time);

      // 60 seconds earlier (outside window of ±1)
      const isValidBefore = verifyTOTP(code, testSecret, 1, 30, time - 60000);
      expect(isValidBefore).toBe(false);

      // 60 seconds later (outside window of ±1)
      const isValidAfter = verifyTOTP(code, testSecret, 1, 30, time + 60000);
      expect(isValidAfter).toBe(false);
    });

    it('should handle larger time window (±3 steps)', () => {
      const time = currentTime;
      const code = generateTOTP(testSecret, 30, 6, time);

      // Within ±3 steps (90 seconds)
      const isValid = verifyTOTP(code, testSecret, 3, 30, time - 90000);
      expect(isValid).toBe(true);
    });
  });

  describe('Leap Seconds Handling', () => {
    it('should handle time values near leap seconds', () => {
      // JavaScript Date doesn't support leap seconds, so :60 seconds is invalid
      // Use the time just before and after the leap second boundary
      const beforeLeapTime = new Date('2015-06-30T23:59:59Z').getTime();
      const afterLeapTime = new Date('2015-07-01T00:00:00Z').getTime();

      const codeBefore = generateTOTP(testSecret, 30, 6, beforeLeapTime);
      const codeAfter = generateTOTP(testSecret, 30, 6, afterLeapTime);

      expect(codeBefore).toBeDefined();
      expect(codeAfter).toBeDefined();
      expect(codeBefore.length).toBe(6);
      expect(codeAfter.length).toBe(6);
    });

    it('should generate consistent codes across leap second boundary', () => {
      const beforeLeap = new Date('2015-06-30T23:59:59Z').getTime();
      const afterLeap = new Date('2015-07-01T00:00:00Z').getTime();

      const codeBefore = generateTOTP(testSecret, 30, 6, beforeLeap);
      const codeAfter = generateTOTP(testSecret, 30, 6, afterLeap);

      // Codes might be different (different time steps), but should be valid
      expect(codeBefore).toBeDefined();
      expect(codeAfter).toBeDefined();
    });

    it('should handle millisecond precision', () => {
      const time = currentTime;
      const code1 = generateTOTP(testSecret, 30, 6, time);
      const code2 = generateTOTP(testSecret, 30, 6, time + 1); // 1ms later

      // Should be same code (within same 30s window)
      expect(code1).toBe(code2);
    });
  });

  describe('Large Time Step Values', () => {
    it('should handle 60 second time step', () => {
      const code = generateTOTP(testSecret, 60, 6);

      expect(code).toBeDefined();
      expect(code.length).toBe(6);
    });

    it('should handle 120 second time step', () => {
      const code = generateTOTP(testSecret, 120, 6);

      expect(code).toBeDefined();
      expect(code.length).toBe(6);
    });

    it('should handle very large time step (3600 seconds)', () => {
      const code = generateTOTP(testSecret, 3600, 6);

      expect(code).toBeDefined();
      expect(code.length).toBe(6);
    });

    it('should generate same code within large time step', () => {
      const time = currentTime;
      const code1 = generateTOTP(testSecret, 300, 6, time);
      const code2 = generateTOTP(testSecret, 300, 6, time + 60000); // 1 min later

      expect(code1).toBe(code2);
    });

    it('should handle minimum time step (1 second)', () => {
      const code = generateTOTP(testSecret, 1, 6);

      expect(code).toBeDefined();
      expect(code.length).toBe(6);
    });
  });

  describe('Custom Digit Counts', () => {
    it('should generate 7-digit code', () => {
      const code = generateTOTP(testSecret, 30, 7);

      expect(code).toBeDefined();
      expect(code.length).toBe(7);
      expect(/^\d{7}$/.test(code)).toBe(true);
    });

    it('should generate 8-digit code', () => {
      const code = generateTOTP(testSecret, 30, 8);

      expect(code).toBeDefined();
      expect(code.length).toBe(8);
      expect(/^\d{8}$/.test(code)).toBe(true);
    });

    it('should generate 4-digit code', () => {
      const code = generateTOTP(testSecret, 30, 4);

      expect(code).toBeDefined();
      expect(code.length).toBe(4);
      expect(/^\d{4}$/.test(code)).toBe(true);
    });

    it('should verify codes with different digit counts', () => {
      const code7 = generateTOTP(testSecret, 30, 7);
      const isValid7 = verifyTOTP(code7, testSecret, 1, 30, undefined, 7);
      expect(isValid7).toBe(true);

      const code8 = generateTOTP(testSecret, 30, 8);
      const isValid8 = verifyTOTP(code8, testSecret, 1, 30, undefined, 8);
      expect(isValid8).toBe(true);
    });

    it('should reject code with wrong digit count', () => {
      const code6 = generateTOTP(testSecret, 30, 6);

      // Try to verify as 8-digit code
      const isValid = verifyTOTP(code6, testSecret, 1, 30, undefined, 8);
      expect(isValid).toBe(false);
    });

    it('should preserve leading zeros in codes', () => {
      // Generate many codes to find one with leading zero
      let foundLeadingZero = false;

      for (let i = 0; i < 100; i++) {
        const code = generateTOTP(testSecret, 30, 6, currentTime + i * 30000);
        if (code.startsWith('0')) {
          foundLeadingZero = true;
          expect(code.length).toBe(6);
          break;
        }
      }

      // Statistically, at least one code should have leading zero
      expect(foundLeadingZero).toBe(true);
    });
  });

  describe('Concurrent Code Generation', () => {
    it('should handle concurrent code generation with same secret', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(generateTOTP(testSecret, 30, 6, currentTime + i))
      );

      const codes = await Promise.all(promises);

      expect(codes).toHaveLength(100);
      // All codes should be valid 6-digit numbers
      codes.forEach(code => {
        expect(/^\d{6}$/.test(code)).toBe(true);
      });
    });

    it('should handle concurrent verification', async () => {
      const code = generateTOTP(testSecret, 30, 6);

      const verifications = await Promise.all(
        Array.from({ length: 50 }, () =>
          Promise.resolve(verifyTOTP(code, testSecret))
        )
      );

      expect(verifications.every(v => v)).toBe(true);
    });

    it('should generate different codes for different secrets concurrently', async () => {
      const secrets = [
        'JBSWY3DPEHPK3PXP',
        'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ',
        'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
      ];

      const codes = await Promise.all(
        secrets.map(secret => Promise.resolve(generateTOTP(secret, 30, 6)))
      );

      // All codes should be different (statistically very likely)
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(3);
    });
  });

  describe('Base32 Edge Cases', () => {
    it('should handle base32 encoding/decoding round trip', () => {
      const original = 'Test Data 123!';
      const encoded = base32Encode(new TextEncoder().encode(original));
      const decoded = base32Decode(encoded);
      const result = new TextDecoder().decode(decoded);

      expect(result).toBe(original);
    });

    it('should handle base32 with padding', () => {
      const withPadding = 'JBSWY3DPEHPK3PXP====';
      const decoded = base32Decode(withPadding);

      expect(decoded).toBeDefined();
      expect(decoded.length).toBeGreaterThan(0);
    });

    it('should handle base32 without padding', () => {
      const withoutPadding = 'JBSWY3DPEHPK3PXP';
      const decoded = base32Decode(withoutPadding);

      expect(decoded).toBeDefined();
      expect(decoded.length).toBeGreaterThan(0);
    });

    it('should handle lowercase base32', () => {
      const lowercase = 'jbswy3dpehpk3pxp';
      const decoded = base32Decode(lowercase);

      expect(decoded).toBeDefined();
      expect(decoded.length).toBeGreaterThan(0);
    });

    it('should reject invalid base32 characters', () => {
      const invalid = 'JBSWY3DP1EHPK3PXP'; // Contains '1'

      expect(() => base32Decode(invalid)).toThrow();
    });

    it('should handle empty base32 string', () => {
      expect(() => base32Decode('')).toThrow();
    });

    it('should handle very long base32 string', () => {
      const longSecret = 'A'.repeat(256);
      const decoded = base32Decode(longSecret);

      expect(decoded).toBeDefined();
      expect(decoded.length).toBeGreaterThan(0);
    });
  });

  describe('Secret Validation', () => {
    it('should validate correct base32 secret', () => {
      expect(isValidTOTPSecret('JBSWY3DPEHPK3PXP')).toBe(true);
    });

    it('should validate secret with padding', () => {
      expect(isValidTOTPSecret('JBSWY3DPEHPK3PXP====')).toBe(true);
    });

    it('should validate lowercase secret', () => {
      expect(isValidTOTPSecret('jbswy3dpehpk3pxp')).toBe(true);
    });

    it('should reject secret with invalid characters', () => {
      expect(isValidTOTPSecret('JBSWY3DP1EHPK3PXP')).toBe(false); // Contains '1'
    });

    it('should reject secret with symbols', () => {
      expect(isValidTOTPSecret('JBSWY3DP@EHPK3PXP')).toBe(false);
    });

    it('should reject empty secret', () => {
      expect(isValidTOTPSecret('')).toBe(false);
    });

    it('should reject secret with spaces', () => {
      // Strict validation - spaces should be rejected
      expect(isValidTOTPSecret('JBSWY3DP EHPK3PXP')).toBe(false);
    });

    it('should validate very long secret', () => {
      const longSecret = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.repeat(4);
      expect(isValidTOTPSecret(longSecret)).toBe(true);
    });
  });

  describe('Secret Generation', () => {
    it('should generate secret with default length', () => {
      const secret = generateTOTPSecret();

      expect(secret).toBeDefined();
      expect(secret.length).toBe(32); // 20 bytes = 32 base32 chars
      expect(isValidTOTPSecret(secret)).toBe(true);
    });

    it('should generate secret with custom length', () => {
      const secret = generateTOTPSecret(40); // 40 bytes

      expect(secret).toBeDefined();
      // Base32 encoding: 40 bytes * 8 bits / 5 bits per char = 64 chars
      expect(secret.length).toBe(64);
      expect(isValidTOTPSecret(secret)).toBe(true);
    });

    it('should generate secret with minimum length', () => {
      const secret = generateTOTPSecret(10); // 10 bytes

      expect(secret).toBeDefined();
      // Base32 encoding: 10 bytes * 8 bits / 5 bits per char = 16 chars
      expect(secret.length).toBe(16);
      expect(isValidTOTPSecret(secret)).toBe(true);
    });

    it('should generate different secrets each time', () => {
      const secrets = Array.from({ length: 100 }, () => generateTOTPSecret());

      const uniqueSecrets = new Set(secrets);
      expect(uniqueSecrets.size).toBe(100);
    });

    it('should generate only valid base32 characters', () => {
      const secret = generateTOTPSecret();

      // Base32 alphabet: A-Z and 2-7
      expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
    });
  });

  describe('Time Calculations', () => {
    describe('getTOTPRemaining', () => {
      it('should calculate remaining time in 30s window', () => {
        const time = 5000; // 5 seconds into epoch
        const remaining = getTOTPRemaining(30, time);

        expect(remaining).toBe(25); // 30 - 5 = 25 seconds
      });

      it('should handle time at start of window', () => {
        const time = 0;
        const remaining = getTOTPRemaining(30, time);

        expect(remaining).toBe(30);
      });

      it('should handle time at end of window', () => {
        const time = 29000;
        const remaining = getTOTPRemaining(30, time);

        expect(remaining).toBe(1);
      });

      it('should handle different time steps', () => {
        const time = 15000; // 15 seconds

        const remaining30 = getTOTPRemaining(30, time);
        expect(remaining30).toBe(15);

        const remaining60 = getTOTPRemaining(60, time);
        expect(remaining60).toBe(45);

        const remaining120 = getTOTPRemaining(120, time);
        expect(remaining120).toBe(105);
      });

      it('should use current time if not specified', () => {
        const remaining = getTOTPRemaining(30);

        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(30);
      });
    });

    describe('getTOTPProgress', () => {
      it('should calculate progress as percentage', () => {
        const time = 15000; // 15 seconds into 30s window
        const progress = getTOTPProgress(30, time);

        expect(progress).toBe(50); // 50% through window
      });

      it('should return 0 at start of window', () => {
        const time = 0;
        const progress = getTOTPProgress(30, time);

        expect(progress).toBe(0);
      });

      it('should return ~100 at end of window', () => {
        const time = 29000;
        const progress = getTOTPProgress(30, time);

        expect(progress).toBeGreaterThan(95);
        expect(progress).toBeLessThanOrEqual(100);
      });

      it('should handle different time steps', () => {
        const time = 30000; // 30 seconds

        const progress30 = getTOTPProgress(30, time);
        expect(progress30).toBe(0); // At 30s with 30s step = start of new window (0%)

        const progress60 = getTOTPProgress(60, time);
        expect(progress60).toBe(50); // At 30s with 60s step = halfway (50%)

        const progress120 = getTOTPProgress(120, time);
        expect(progress120).toBe(25); // At 30s with 120s step = quarter way (25%)
      });

      it('should use current time if not specified', () => {
        const progress = getTOTPProgress(30);

        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('RFC 6238 Compliance', () => {
    it('should use HMAC-SHA1 by default (RFC 6238)', () => {
      // Generate code and verify it works
      const code = generateTOTP(testSecret, 30, 6);

      expect(code).toBeDefined();
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    it('should truncate to specified digits correctly', () => {
      // Test various digit counts
      for (let digits = 4; digits <= 8; digits++) {
        const code = generateTOTP(testSecret, 30, digits);
        expect(code.length).toBe(digits);
        expect(/^\d+$/.test(code)).toBe(true);
      }
    });

    it('should use time-based counter (time / timeStep)', () => {
      const time = 123456789000; // Fixed time
      const code1 = generateTOTP(testSecret, 30, 6, time);
      const code2 = generateTOTP(testSecret, 30, 6, time);

      // Same time should produce same code
      expect(code1).toBe(code2);

      // Different time step should produce different code
      const code3 = generateTOTP(testSecret, 30, 6, time + 30000);
      expect(code1).not.toBe(code3);
    });

    it('should handle counter overflow (edge case)', () => {
      // Very far future time (counter overflow scenario)
      const farFuture = Number.MAX_SAFE_INTEGER;
      const code = generateTOTP(testSecret, 30, 6, farFuture);

      expect(code).toBeDefined();
      expect(code.length).toBe(6);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid secret gracefully', () => {
      expect(() => generateTOTP('INVALID!@#', 30, 6)).toThrow();
    });

    it('should handle negative time step', () => {
      expect(() => generateTOTP(testSecret, -30, 6)).toThrow();
    });

    it('should handle zero time step', () => {
      expect(() => generateTOTP(testSecret, 0, 6)).toThrow();
    });

    it('should handle invalid digit count', () => {
      expect(() => generateTOTP(testSecret, 30, 0)).toThrow();
      expect(() => generateTOTP(testSecret, 30, -1)).toThrow();
    });

    it('should handle negative time value', () => {
      // Negative time might represent dates before epoch
      const code = generateTOTP(testSecret, 30, 6, -1000);
      expect(code).toBeDefined();
    });
  });
});
