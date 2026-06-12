/**
 * P4 — HIBP prefix store tests: prefix computation, persistence lifecycle,
 * and the v8 breachPrefixes migration (table exists and is additive).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeSha1Prefix,
  saveBreachPrefix,
  deleteBreachPrefix,
  getAllBreachPrefixes,
  SHA1_PREFIX_LENGTH,
} from '../breachPrefixStore';
import { db } from '@/data/storage/database';

describe('computeSha1Prefix', () => {
  it('returns the first 5 uppercase hex chars of the SHA-1 hash', () => {
    // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    expect(computeSha1Prefix('password')).toBe('5BAA6');
  });

  it('always returns exactly SHA1_PREFIX_LENGTH uppercase hex chars', () => {
    for (const pw of ['', 'a', 'correct horse battery staple', '密碼🔐']) {
      const prefix = computeSha1Prefix(pw);
      expect(prefix).toMatch(/^[0-9A-F]{5}$/);
      expect(prefix).toHaveLength(SHA1_PREFIX_LENGTH);
    }
  });
});

describe('breachPrefixes table (v8 migration)', () => {
  beforeEach(async () => {
    await db.open();
    await db.breachPrefixes.clear();
  });

  it('exposes the breachPrefixes table at DB version >= 8', () => {
    expect(db.verno).toBeGreaterThanOrEqual(8);
    expect(db.breachPrefixes).toBeDefined();
  });

  it('saves, upserts, and deletes prefix rows keyed by credentialId', async () => {
    await saveBreachPrefix('cred-1', 'password', 'test-user');
    let rows = await getAllBreachPrefixes();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sha1Prefix).toBe('5BAA6');
    expect(rows[0]?.credentialId).toBe('cred-1');

    // Upsert on password change — still one row, new prefix.
    await saveBreachPrefix('cred-1', 'hunter2', 'test-user');
    rows = await getAllBreachPrefixes();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sha1Prefix).toBe(computeSha1Prefix('hunter2'));

    await deleteBreachPrefix('cred-1');
    expect(await getAllBreachPrefixes()).toHaveLength(0);
  });

  it('clearAll() wipes the prefix store', async () => {
    await saveBreachPrefix('cred-1', 'password', 'test-user');
    await db.clearAll();
    expect(await getAllBreachPrefixes()).toHaveLength(0);
  });
});
