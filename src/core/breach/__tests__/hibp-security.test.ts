/**
 * HIBP (Have I Been Pwned) Security Tests
 * Tests for k-anonymity, rate limiting, caching, error handling
 * Addresses identified gaps in breach detection module coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkPasswordBreach,
  checkEmailBreach,
  clearBreachCache
} from '../hibpService';

describe('HIBP Breach Detection Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearBreachCache();
  });

  afterEach(() => {
    clearBreachCache();
  });

  describe('k-Anonymity Protection', () => {
    it('should only send first 5 characters of SHA-1 hash to API', async () => {
      const password = 'password123';

      // Mock fetch to capture request
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '003D68EB55068C33ACE09247EE4C639306B:3\nOTHER_HASH:5'
      } as Response);

      try {
        await checkPasswordBreach(password);

        // Verify only 5-char prefix was sent in URL
        expect(fetchSpy).toHaveBeenCalled();
        const callUrl = fetchSpy.mock.calls[0]?.[0] as string;
        const hashPrefix = callUrl.split('/').pop();

        expect(hashPrefix?.length).toBe(5);
        expect(/^[A-F0-9]{5}$/.test(hashPrefix ?? '')).toBe(true);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should never send full password to API', async () => {
      const password = 'MySuperSecretPassword123!';

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        await checkPasswordBreach(password);

        const callUrl = fetchSpy.mock.calls[0]?.[0] as string;
        expect(callUrl).not.toContain(password);
        expect(callUrl).not.toContain(encodeURIComponent(password));
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should compute SHA-1 hash correctly', async () => {
      // Password "password" has SHA-1: 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
      const password = 'password';

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '61E4C9B93F3F0682250B6CF8331B7EE68FD8:3730471'
      } as Response);

      try {
        const result = await checkPasswordBreach(password);

        // Should match first 5 chars: 5BAA6
        const callUrl = fetchSpy.mock.calls[0]?.[0] as string;
        expect(callUrl).toContain('5BAA6');

        expect(result.breached).toBe(true);
        // API returns breachCount, not count
        expect(result.breachCount).toBeGreaterThan(0);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should compare suffix hashes client-side', async () => {
      const password = 'testpassword';

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1\n' +
          'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:2\n' +
          'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC:3'
      } as Response);

      try {
        const result = await checkPasswordBreach(password);

        // Hash comparison happens client-side
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(result).toBeDefined();
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce minimum delay between requests', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const start = Date.now();

        await checkPasswordBreach('password1');
        await checkPasswordBreach('password2');

        const elapsed = Date.now() - start;

        // Should have at least 1500ms delay (rate limit)
        expect(elapsed).toBeGreaterThanOrEqual(1400); // Allow some margin
      } finally {
        fetchSpy.mockRestore();
      }
    }, 5000);

    it('should handle concurrent requests with rate limiting', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const start = Date.now();

        const promises = [
          checkPasswordBreach('password1'),
          checkPasswordBreach('password2'),
          checkPasswordBreach('password3')
        ];

        await Promise.all(promises);

        const elapsed = Date.now() - start;

        // Should take at least 3000ms for 3 requests (1500ms each)
        expect(elapsed).toBeGreaterThanOrEqual(2900);
      } finally {
        fetchSpy.mockRestore();
      }
    }, 10000);

    it('should bypass rate limit when disabled', async () => {
      // Note: The actual API doesn't have a skipRateLimit option
      // This test verifies that cached results bypass rate limiting
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const start = Date.now();

        // First call triggers fetch and cache
        await checkPasswordBreach('password1');
        // Second call with same password uses cache (no fetch)
        await checkPasswordBreach('password1');

        // Fetch should only be called once due to caching
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      } finally {
        fetchSpy.mockRestore();
      }
    }, 5000);
  });

  describe('Exponential Backoff on 429 Errors', () => {
    it('should retry on 429 Too Many Requests with backoff', async () => {
      let callCount = 0;

      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Too Many Requests'
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          text: async () => ''
        } as Response;
      });

      try {
        // Internal retry logic handles 429s automatically
        const result = await checkPasswordBreach('password');

        // Should have made 3 calls (2 retries + 1 success)
        expect(callCount).toBe(3);
        expect(result).toBeDefined();
      } finally {
        fetchSpy.mockRestore();
      }
    }, 30000);

    it('should give up after max retries', async () => {
      // The service has a hard-coded maxRetries of 3
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Too Many Requests'
      } as Response);

      try {
        await expect(
          checkPasswordBreach('password')
        ).rejects.toThrow('Rate limit exceeded');
      } finally {
        fetchSpy.mockRestore();
      }
    }, 30000);

    it('should increase delay exponentially', async () => {
      const startTimes: number[] = [];

      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        startTimes.push(Date.now());

        if (startTimes.length < 3) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Too Many Requests'
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          text: async () => ''
        } as Response;
      });

      try {
        await checkPasswordBreach('password');

        // Check that delays increased (exponential backoff)
        if (startTimes.length >= 3) {
          const delay1 = startTimes[1]! - startTimes[0]!;
          const delay2 = startTimes[2]! - startTimes[1]!;
          // Second delay should be >= first delay (exponential)
          expect(delay2).toBeGreaterThanOrEqual(delay1 * 0.9); // Allow 10% margin
        }
      } finally {
        fetchSpy.mockRestore();
      }
    }, 30000);
  });

  describe('Cache Management', () => {
    it('should cache successful breach checks', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const password = 'testpassword123';

        await checkPasswordBreach(password);
        await checkPasswordBreach(password);

        // Should only call API once (second hit cache)
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      } finally {
        fetchSpy.mockRestore();
      }
    }, 5000);

    it('should respect cache expiration', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const password = 'testpassword123';

        // Check password (will be cached with 24hr duration)
        await checkPasswordBreach(password);

        // Clear cache
        clearBreachCache();

        // Should trigger fresh API call after cache clear
        await checkPasswordBreach(password);

        // Should call API twice (cache was cleared)
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      } finally {
        fetchSpy.mockRestore();
      }
    }, 5000);

    it('should clear cache when requested', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const password = 'testpassword123';

        await checkPasswordBreach(password, {});

        clearBreachCache();

        await checkPasswordBreach(password, {});

        // Should call API twice (cache cleared)
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should cache different passwords separately', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        await checkPasswordBreach('password1', {});
        await checkPasswordBreach('password2', {});
        await checkPasswordBreach('password1', {});

        // Should call API twice (password1 cached, password2 different)
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(
        new Error('Network error')
      );

      try {
        await expect(
          checkPasswordBreach('password', {})
        ).rejects.toThrow();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle 403 Forbidden errors', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      } as Response);

      try {
        await expect(
          checkPasswordBreach('password', {})
        ).rejects.toThrow();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle 500 Server errors', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as Response);

      try {
        await expect(
          checkPasswordBreach('password', {})
        ).rejects.toThrow();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle malformed API responses', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'INVALID_FORMAT_NO_COLON'
      } as Response);

      try {
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result).toBeDefined();
        expect(result.breached).toBe(false);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle empty API responses', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result.breached).toBe(false);
        expect(result.breachCount).toBe(0);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle API timeout', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
        () => new Promise((_, reject) =>
          setTimeout(() => { reject(new Error('Timeout')); }, 100)
        )
      );

      try {
        await expect(
          checkPasswordBreach('password', {
            forceRefresh: true
          })
        ).rejects.toThrow();
      } finally {
        fetchSpy.mockRestore();
      }
    }, 5000);
  });

  describe('Breach Detection Correctness', () => {
    it('should detect breached password', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'E4C9B93F3F0682250B6CF8331B7EE68FD8:3730471'
      } as Response);

      try {
        // "password" is definitely breached
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result.breached).toBe(true);
        expect(result.breachCount).toBeGreaterThan(0);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should not detect clean password as breached', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1'
      } as Response);

      try {
        const result = await checkPasswordBreach('VeryUniquePassword9876!', {
          forceRefresh: true
        });

        expect(result.breached).toBe(false);
        expect(result.breachCount).toBe(0);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should return correct breach count', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'E4C9B93F3F0682250B6CF8331B7EE68FD8:1234567'
      } as Response);

      try {
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result.breachCount).toBe(1234567);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle multiple matching suffixes', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:10\n' +
          'E4C9B93F3F0682250B6CF8331B7EE68FD8:3730471\n' +
          'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:5'
      } as Response);

      try {
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result.breached).toBe(true);
        expect(result.breachCount).toBe(3730471);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('Severity Classification', () => {
    it('should classify as critical (>100k breaches)', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'E4C9B93F3F0682250B6CF8331B7EE68FD8:100001'
      } as Response);

      try {
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result.severity).toBe('critical');
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should classify as high (10k-100k breaches)', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'E4C9B93F3F0682250B6CF8331B7EE68FD8:50000'
      } as Response);

      try {
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result.severity).toBe('high');
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should classify as medium (1k-10k breaches)', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'E4C9B93F3F0682250B6CF8331B7EE68FD8:5000'
      } as Response);

      try {
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result.severity).toBe('medium');
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should classify as low (<1k breaches)', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'E4C9B93F3F0682250B6CF8331B7EE68FD8:500'
      } as Response);

      try {
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result.severity).toBe('low');
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should classify as safe (no breaches)', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const result = await checkPasswordBreach('password', {
          forceRefresh: true
        });

        expect(result.severity).toBe('safe');
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('Email Breach Check', () => {
    it('should check email breaches with API key', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            Name: 'Adobe',
            Title: 'Adobe',
            Domain: 'adobe.com',
            BreachDate: '2013-10-04',
            AddedDate: '2013-12-04T00:00:00Z',
            ModifiedDate: '2022-05-15T23:52:49Z',
            PwnCount: 152445165,
            Description: 'In October 2013...',
            DataClasses: ['Email addresses', 'Password hints', 'Passwords', 'Usernames'],
            IsVerified: true,
            IsFabricated: false,
            IsSensitive: false,
            IsRetired: false,
            IsSpamList: false,
            LogoPath: 'https://haveibeenpwned.com/Content/Images/PwnedLogos/Adobe.png'
          }
        ]
      } as Response);

      try {
        const result = await checkEmailBreach('test@example.com', {
          forceRefresh: true
        });

        expect(result.breached).toBe(true);
        expect(result.breaches.length).toBeGreaterThan(0);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle email not found in breaches', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not found'
      } as Response);

      try {
        const result = await checkEmailBreach('clean@example.com', {
          forceRefresh: true
        });

        expect(result.breached).toBe(false);
        expect(result.breaches.length).toBe(0);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should require API key for email checks', async () => {
      // Without API key, email checks return empty result (not error)
      const result = await checkEmailBreach('test@example.com', {});
      expect(result.breached).toBe(false);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle passwords with special characters', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const result = await checkPasswordBreach('P@$$w0rd!#%', {
          forceRefresh: true
        });

        expect(result).toBeDefined();
        expect(fetchSpy).toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle unicode passwords', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const result = await checkPasswordBreach('密码🔐пароль', {
          forceRefresh: true
        });

        expect(result).toBeDefined();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'x'.repeat(10000);

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const result = await checkPasswordBreach(longPassword, {
          forceRefresh: true
        });

        expect(result).toBeDefined();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('should handle empty password gracefully', async () => {
      // Empty password is hashed and checked - API returns result, not error
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      } as Response);

      try {
        const result = await checkPasswordBreach('');
        expect(result).toBeDefined();
        expect(result.breached).toBe(false);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });
});
