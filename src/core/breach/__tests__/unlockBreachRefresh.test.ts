/**
 * P4 — on-unlock refresh tests: 7-day staleness window and the
 * last-full-check bookkeeping in localStorage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isBreachCheckStale,
  markBreachCheckComplete,
  getLastFullCheckAt,
  LAST_FULL_CHECK_KEY,
  FULL_CHECK_INTERVAL_MS,
} from '../unlockBreachRefresh';

describe('breach check staleness', () => {
  beforeEach(() => {
    localStorage.removeItem(LAST_FULL_CHECK_KEY);
  });

  it('is stale when no check has ever run', () => {
    expect(isBreachCheckStale()).toBe(true);
    expect(getLastFullCheckAt()).toBeNull();
  });

  it('is fresh immediately after a completed check', () => {
    const now = 1_750_000_000_000;
    markBreachCheckComplete(now);
    expect(getLastFullCheckAt()).toBe(now);
    expect(isBreachCheckStale(now)).toBe(false);
    expect(isBreachCheckStale(now + FULL_CHECK_INTERVAL_MS - 1)).toBe(false);
  });

  it('becomes stale once the 7-day window elapses', () => {
    const now = 1_750_000_000_000;
    markBreachCheckComplete(now);
    expect(isBreachCheckStale(now + FULL_CHECK_INTERVAL_MS)).toBe(true);
  });

  it('treats a corrupted timestamp as stale', () => {
    localStorage.setItem(LAST_FULL_CHECK_KEY, 'garbage');
    expect(isBreachCheckStale()).toBe(true);
    expect(getLastFullCheckAt()).toBeNull();
  });
});
