/**
 * getAllBreachedCredentials must return breached results even though
 * IndexedDB cannot index a boolean `breached` column - Dexie silently
 * omits non-indexable values from the index, so where('breached').equals(1)
 * always returned an empty array (Security Audit page bug, 2026-06-15).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import {
  saveBreachResult,
  getAllBreachedCredentials,
  getBreachStatistics,
} from '@/data/repositories/breachResultsRepository';
import type { BreachCheckResult } from '@/core/breach/breachTypes';

const userId = 'user-1';

describe('getAllBreachedCredentials', () => {
  beforeEach(async () => {
    await db.breachResults.clear();
  });

  it('returns breached credentials for the user', async () => {
    const breached: BreachCheckResult = {
      breached: true,
      breaches: [],
      severity: 'high',
      checkedAt: Date.now(),
      breachCount: 1234,
    };
    const safe: BreachCheckResult = {
      breached: false,
      breaches: [],
      severity: 'safe',
      checkedAt: Date.now(),
      breachCount: 0,
    };

    await saveBreachResult('cred-1', 'password', breached, userId);
    await saveBreachResult('cred-2', 'password', safe, userId);

    const results = await getAllBreachedCredentials(userId);

    expect(results).toHaveLength(1);
    expect(results[0]?.credentialId).toBe('cred-1');
    expect(results[0]?.severity).toBe('high');
    expect(results[0]?.breachCount).toBe(1234);
  });

  it('stays consistent with getBreachStatistics', async () => {
    const breached: BreachCheckResult = {
      breached: true,
      breaches: [],
      severity: 'critical',
      checkedAt: Date.now(),
      breachCount: 10000,
    };

    await saveBreachResult('cred-1', 'password', breached, userId);

    const breachedCredentials = await getAllBreachedCredentials(userId);
    const stats = await getBreachStatistics(userId);

    expect(breachedCredentials).toHaveLength(stats.breached);
  });
});
