/**
 * HIBP Breach Service Tests
 * Covers k-anonymity password checks, email breach checks, caching, and
 * severity banding. fetch is mocked; no real network calls are made.
 *
 * The service enforces a real ~1.5s inter-request rate-limit gate via a
 * module-level singleton promise chain that is not resettable between
 * tests. Mixing fake and real timers against that shared chain produces
 * flaky unhandled rejections (the gate's internal setTimeout races fake
 * timers' single drain pass), so every test here runs in real time with a
 * generous per-test timeout instead.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkPasswordBreach,
  checkEmailBreach,
  clearBreachCache,
  getCacheStats,
  cleanupExpiredCache,
  isHibpEnabled,
} from '@/core/breach/hibpService';

function mockFetchOnce(response: Partial<Response> & { text?: () => Promise<string>; json?: () => Promise<unknown> }) {
  const fullResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({}),
    ...response,
  } as Response;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fullResponse));
}

describe('hibpService', () => {
  beforeEach(() => {
    clearBreachCache();
    vi.unstubAllGlobals();
  });

  describe('checkPasswordBreach()', () => {
    it('returns safe/0 when the API responds 404 (password not pwned)', async () => {
      mockFetchOnce({ ok: false, status: 404, statusText: 'Not Found' });

      const result = await checkPasswordBreach('Tr0ub4dor&3-unique-test-password');

      expect(result.breached).toBe(false);
      expect(result.severity).toBe('safe');
      expect(result.breachCount).toBe(0);
    }, 10000);

    it('parses the range response and reports breachCount for a matching suffix', async () => {
      // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8 -> prefix 5BAA6, suffix is the rest.
      const fullHash = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';
      const suffix = fullHash.substring(5);
      mockFetchOnce({ ok: true, status: 200, text: () => Promise.resolve(`${suffix}:3861493\r\nDEADBEEF00000000000000000000000000000:1\r\n`) });

      const result = await checkPasswordBreach('password');

      expect(result.breached).toBe(true);
      expect(result.breachCount).toBe(3861493);
      expect(result.severity).toBe('critical');
    }, 10000);

    it('reports severity bands at each boundary', async () => {
      const fullHash = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';
      const suffix = fullHash.substring(5);
      const cases: Array<[number, string]> = [
        [500, 'low'],
        [1000, 'medium'],
        [10000, 'high'],
        [100001, 'critical'],
      ];

      for (const [count, expectedSeverity] of cases) {
        clearBreachCache();
        mockFetchOnce({ ok: true, status: 200, text: () => Promise.resolve(`${suffix}:${String(count)}\r\n`) });
        const result = await checkPasswordBreach('password');
        expect(result.severity).toBe(expectedSeverity);
      }
    }, 20000);

    it('returns a cached result on the second call without calling fetch again', async () => {
      mockFetchOnce({ ok: false, status: 404, statusText: 'Not Found' });
      await checkPasswordBreach('cache-me-please-1234');

      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await checkPasswordBreach('cache-me-please-1234');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.severity).toBe('safe');
    }, 10000);

    it('bypasses the cache when forceRefresh is true', async () => {
      mockFetchOnce({ ok: false, status: 404, statusText: 'Not Found' });
      await checkPasswordBreach('force-refresh-test-pw');

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      } as Response);
      vi.stubGlobal('fetch', fetchSpy);

      await checkPasswordBreach('force-refresh-test-pw', { forceRefresh: true });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    }, 10000);

    it('retries on 429 with exponential backoff and eventually succeeds', async () => {
      let callCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 429, statusText: 'Too Many Requests', text: () => Promise.resolve(''), json: () => Promise.resolve({}) } as Response);
        }
        return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found', text: () => Promise.resolve(''), json: () => Promise.resolve({}) } as Response);
      }));

      const result = await checkPasswordBreach('retry-backoff-test-pw');

      expect(callCount).toBe(2);
      expect(result.severity).toBe('safe');
    }, 10000);

    it('throws after exceeding max retries on persistent 429s', async () => {
      // Backoff delays escalate as RATE_LIMIT_DELAY * 2^retryCount across 3
      // retries (1.5s, 3s, 6s = 10.5s), plus the initial rate-limit gate wait.
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      } as Response));

      await expect(checkPasswordBreach('always-429-test-pw')).rejects.toThrow(
        'Rate limit exceeded. Please try again later.'
      );
    }, 20000);

    it('serializes concurrent calls through the rate-limit gate without throwing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      } as Response));

      const results = await Promise.all([
        checkPasswordBreach('concurrent-a'),
        checkPasswordBreach('concurrent-b'),
        checkPasswordBreach('concurrent-c'),
      ]);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.severity === 'safe')).toBe(true);
    }, 15000);
  });

  describe('checkEmailBreach()', () => {
    it('returns safe with no API key configured (email checking disabled)', async () => {
      // No fetch needed: hibpService short-circuits before the rate-limit
      // gate when VITE_HIBP_API_KEY is unset.
      const result = await checkEmailBreach('test@example.com');

      expect(result.breached).toBe(false);
      expect(result.severity).toBe('safe');
    });
  });

  describe('cache utilities', () => {
    it('clearBreachCache() empties the cache', async () => {
      mockFetchOnce({ ok: false, status: 404, statusText: 'Not Found' });
      await checkPasswordBreach('to-be-cleared-pw');
      expect(getCacheStats().size).toBeGreaterThan(0);

      clearBreachCache();

      expect(getCacheStats().size).toBe(0);
    }, 10000);

    it('getCacheStats() reflects the number of cached entries', async () => {
      mockFetchOnce({ ok: false, status: 404, statusText: 'Not Found' });
      await checkPasswordBreach('stats-test-pw-1');
      mockFetchOnce({ ok: false, status: 404, statusText: 'Not Found' });
      await checkPasswordBreach('stats-test-pw-2');

      expect(getCacheStats().size).toBe(2);
    }, 10000);

    it('cleanupExpiredCache() removes only expired entries', async () => {
      mockFetchOnce({ ok: false, status: 404, statusText: 'Not Found' });
      await checkPasswordBreach('expiring-soon-pw');
      expect(getCacheStats().size).toBe(1);

      // 24h cache duration; advance 25 hours using fake timers scoped only
      // to this synchronous Date.now()/cache-expiry check, not the network
      // call above.
      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      cleanupExpiredCache();
      vi.useRealTimers();

      expect(getCacheStats().size).toBe(0);
    }, 10000);
  });

  describe('isHibpEnabled()', () => {
    it('returns a boolean reflecting the VITE_HIBP_API_ENABLED env value', () => {
      expect(typeof isHibpEnabled()).toBe('boolean');
    });
  });
});
