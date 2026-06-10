/**
 * HIBP Range Cache (P4 — background breach re-checks)
 *
 * Cache-first lookup of HIBP k-anonymity range responses. The periodic-sync
 * service worker (public/sw-periodic-sync.js) prefetches range responses into
 * the 'hibp-ranges' Cache Storage bucket while the vault is locked; this
 * module consults that cache first so on-unlock breach checks are instant and
 * work offline, falling back to the network (and re-populating the cache) on
 * a miss.
 *
 * The cache name, freshness header, and TTL here MUST stay in sync with
 * public/sw-periodic-sync.js.
 */

import { sha1 } from '@noble/hashes/legacy';
import { bytesToHex } from '@noble/hashes/utils';
import type { BreachCheckResult, BreachSeverity } from './breachTypes';

export const HIBP_RANGE_CACHE = 'hibp-ranges';
export const FETCHED_AT_HEADER = 'x-tv-fetched-at';
export const RANGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const HIBP_API_BASE = 'https://api.pwnedpasswords.com';

/**
 * Parses an HIBP range response ("SUFFIX:COUNT\r\n" lines) and returns the
 * breach count for the given 35-char hash suffix, or 0 if absent.
 */
export function parseRangeResponse(text: string, hashSuffix: string): number {
  for (const line of text.split('\n')) {
    const [suffix, count] = line.trim().split(':');
    if (suffix === hashSuffix && count) {
      const parsed = parseInt(count, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
  }
  return 0;
}

/**
 * Maps a breach count to a severity (same thresholds as hibpService).
 */
export function severityForBreachCount(breachCount: number): BreachSeverity {
  if (breachCount === 0) return 'safe';
  if (breachCount >= 10000) return 'critical';
  if (breachCount >= 1000) return 'high';
  if (breachCount >= 100) return 'medium';
  return 'low';
}

/**
 * Returns true when a cached response is still within the range TTL.
 * Responses without a freshness header are treated as stale.
 */
export function isCachedResponseFresh(
  fetchedAtHeader: string | null,
  now: number = Date.now()
): boolean {
  if (!fetchedAtHeader) return false;
  const fetchedAt = parseInt(fetchedAtHeader, 10);
  if (Number.isNaN(fetchedAt)) return false;
  return now - fetchedAt < RANGE_TTL_MS;
}

function rangeUrl(prefix: string): string {
  return `${HIBP_API_BASE}/range/${prefix}`;
}

/**
 * Returns the range response body for a prefix — from the prefetched cache
 * when fresh, otherwise from the network (re-populating the cache).
 * Throws when both cache and network are unavailable.
 */
export async function getRangeResponse(prefix: string): Promise<string> {
  const url = rangeUrl(prefix);

  let cache: Cache | undefined;
  if (typeof caches !== 'undefined') {
    try {
      cache = await caches.open(HIBP_RANGE_CACHE);
      const cached = await cache.match(url);
      if (cached && isCachedResponseFresh(cached.headers.get(FETCHED_AT_HEADER))) {
        return await cached.text();
      }
    } catch {
      // Cache Storage unavailable (private mode, test env) — fall through.
    }
  }

  const userAgent: string =
    typeof import.meta.env.VITE_HIBP_USER_AGENT === 'string'
      ? import.meta.env.VITE_HIBP_USER_AGENT
      : 'TrustVault-PWA';
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Add-Padding': 'true',
    },
  });
  if (!response.ok) {
    throw new Error(`HIBP range request failed: ${String(response.status)}`);
  }
  const text = await response.text();

  if (cache) {
    try {
      await cache.put(
        url,
        new Response(text, {
          headers: { 'Content-Type': 'text/plain', [FETCHED_AT_HEADER]: String(Date.now()) },
        })
      );
    } catch {
      // Best-effort cache write.
    }
  }
  return text;
}

/**
 * Cache-first equivalent of hibpService.checkPasswordBreach(): instant and
 * offline-capable when the range was prefetched by the periodic-sync worker.
 */
export async function checkPasswordWithCache(password: string): Promise<BreachCheckResult> {
  const hash = bytesToHex(sha1(new TextEncoder().encode(password))).toUpperCase();
  const text = await getRangeResponse(hash.substring(0, 5));
  const breachCount = parseRangeResponse(text, hash.substring(5));

  return {
    breached: breachCount > 0,
    breaches: [], // password range API returns counts only
    severity: severityForBreachCount(breachCount),
    checkedAt: Date.now(),
    breachCount,
  };
}
