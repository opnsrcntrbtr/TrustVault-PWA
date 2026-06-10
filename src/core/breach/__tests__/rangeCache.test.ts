/**
 * P4 — range cache tests: response parsing, severity thresholds, and the
 * cache-freshness rule used by both the app and sw-periodic-sync.js.
 */

import { describe, it, expect } from 'vitest';
import {
  parseRangeResponse,
  severityForBreachCount,
  isCachedResponseFresh,
  RANGE_TTL_MS,
} from '../rangeCache';

describe('parseRangeResponse', () => {
  const SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

  it('finds the matching suffix and returns its count', () => {
    const body = `0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${SUFFIX}:42\r\nFFFFAAA:1`;
    expect(parseRangeResponse(body, SUFFIX)).toBe(42);
  });

  it('returns 0 when the suffix is absent (padded responses include 0-count noise)', () => {
    const body = '0018A45C4D1DEF81644B54AB7F969B88D65:3\r\nAAAA:7';
    expect(parseRangeResponse(body, SUFFIX)).toBe(0);
  });

  it('returns 0 for empty or malformed bodies', () => {
    expect(parseRangeResponse('', SUFFIX)).toBe(0);
    expect(parseRangeResponse(`${SUFFIX}:notanumber`, SUFFIX)).toBe(0);
  });
});

describe('severityForBreachCount', () => {
  it('maps counts to the same thresholds as hibpService', () => {
    expect(severityForBreachCount(0)).toBe('safe');
    expect(severityForBreachCount(1)).toBe('low');
    expect(severityForBreachCount(99)).toBe('low');
    expect(severityForBreachCount(100)).toBe('medium');
    expect(severityForBreachCount(999)).toBe('medium');
    expect(severityForBreachCount(1000)).toBe('high');
    expect(severityForBreachCount(9999)).toBe('high');
    expect(severityForBreachCount(10000)).toBe('critical');
  });
});

describe('isCachedResponseFresh', () => {
  const now = 1_750_000_000_000;

  it('is fresh within the TTL and stale at/after it', () => {
    expect(isCachedResponseFresh(String(now - 1000), now)).toBe(true);
    expect(isCachedResponseFresh(String(now - RANGE_TTL_MS + 1), now)).toBe(true);
    expect(isCachedResponseFresh(String(now - RANGE_TTL_MS), now)).toBe(false);
  });

  it('treats missing or malformed headers as stale', () => {
    expect(isCachedResponseFresh(null, now)).toBe(false);
    expect(isCachedResponseFresh('not-a-number', now)).toBe(false);
  });
});
