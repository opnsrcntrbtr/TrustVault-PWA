import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
} from '../rateLimiter';

const EMAIL = 'test@example.com';

beforeEach(async () => {
  await db.loginAttempts.clear();
});

describe('checkRateLimit', () => {
  it('does not throw when no attempts recorded', async () => {
    await expect(checkRateLimit(EMAIL)).resolves.toBeUndefined();
  });

  it('does not throw when attempts < 5', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 4,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    await expect(checkRateLimit(EMAIL)).resolves.toBeUndefined();
  });

  it('throws when account is locked and lockout has not expired', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 5,
      lockedUntil: Date.now() + 60_000,
      lastAttemptAt: Date.now(),
    });
    await expect(checkRateLimit(EMAIL)).rejects.toThrow(/Too many failed attempts/);
  });

  it('does not throw when lockout has expired', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 5,
      lockedUntil: Date.now() - 1,
      lastAttemptAt: Date.now(),
    });
    await expect(checkRateLimit(EMAIL)).resolves.toBeUndefined();
  });

  it('error message includes remaining time when locked', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 10,
      lockedUntil: Date.now() + 5 * 60_000,
      lastAttemptAt: Date.now(),
    });
    await expect(checkRateLimit(EMAIL)).rejects.toThrow(/5 minute/);
  });
});

describe('recordFailedAttempt', () => {
  it('creates a new record for first failure', async () => {
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(1);
    expect(record?.lockedUntil).toBe(0);
  });

  it('increments existing attempt count', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 3,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(4);
  });

  it('sets 30-second lockout at 5 failures', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 4,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    const before = Date.now();
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(5);
    expect(record?.lockedUntil).toBeGreaterThanOrEqual(before + 29_000);
    expect(record?.lockedUntil).toBeLessThanOrEqual(before + 31_000);
  });

  it('sets 5-minute lockout at 10 failures', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 9,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    const before = Date.now();
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(10);
    expect(record?.lockedUntil).toBeGreaterThanOrEqual(before + 4 * 60_000);
    expect(record?.lockedUntil).toBeLessThanOrEqual(before + 6 * 60_000);
  });

  it('sets 30-minute lockout at 15 failures', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 14,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    const before = Date.now();
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(15);
    expect(record?.lockedUntil).toBeGreaterThanOrEqual(before + 29 * 60_000);
    expect(record?.lockedUntil).toBeLessThanOrEqual(before + 31 * 60_000);
  });

  it('sets 1-hour lockout at 20+ failures', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 19,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    const before = Date.now();
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(20);
    expect(record?.lockedUntil).toBeGreaterThanOrEqual(before + 59 * 60_000);
    expect(record?.lockedUntil).toBeLessThanOrEqual(before + 61 * 60_000);
  });

  // S8: counter must decay so a returning legitimate user is not permanently
  // escalated by stale failures from long ago.
  it('resets the attempt counter after the decay window elapses', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 18,
      lockedUntil: 0,
      lastAttemptAt: Date.now() - 61 * 60_000, // 61 minutes ago
    });
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(1);
    expect(record?.lockedUntil).toBe(0);
  });

  it('keeps escalating for failures within the decay window', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 4,
      lockedUntil: 0,
      lastAttemptAt: Date.now() - 1_000, // 1 second ago
    });
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(5);
  });
});

describe('clearAttempts', () => {
  it('removes the attempt record', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 7,
      lockedUntil: Date.now() + 60_000,
      lastAttemptAt: Date.now(),
    });
    await clearAttempts(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record).toBeUndefined();
  });

  it('does not throw when no record exists', async () => {
    await expect(clearAttempts(EMAIL)).resolves.toBeUndefined();
  });
});
