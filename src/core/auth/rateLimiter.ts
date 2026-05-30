import { db } from '@/data/storage/database';

const THRESHOLDS: Array<{ minAttempts: number; lockMs: number }> = [
  { minAttempts: 20, lockMs: 60 * 60_000 },  // 1 hour
  { minAttempts: 15, lockMs: 30 * 60_000 },  // 30 minutes
  { minAttempts: 10, lockMs:  5 * 60_000 },  // 5 minutes
  { minAttempts:  5, lockMs:       30_000 },  // 30 seconds
];

// After this idle period since the last failed attempt, the counter resets so
// a returning legitimate user starts from a clean slate (S8 — attempt decay).
const ATTEMPT_DECAY_MS = 60 * 60_000; // 1 hour

function lockoutMs(attempts: number): number {
  for (const { minAttempts, lockMs } of THRESHOLDS) {
    if (attempts >= minAttempts) return lockMs;
  }
  return 0;
}

function formatRemaining(lockedUntil: number): string {
  const ms = lockedUntil - Date.now();
  if (ms <= 0) return '0 seconds';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 1) {
    const seconds = Math.ceil(ms / 1_000);
    return `${String(seconds)} second${seconds !== 1 ? 's' : ''}`;
  }
  return `${String(minutes)} minute${minutes !== 1 ? 's' : ''}`;
}

export async function checkRateLimit(identifier: string): Promise<void> {
  const record = await db.loginAttempts.get(identifier);
  if (!record) return;
  if (record.lockedUntil > 0 && Date.now() < record.lockedUntil) {
    throw new Error(
      `Too many failed attempts. Try again in ${formatRemaining(record.lockedUntil)}.`
    );
  }
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  const existing = await db.loginAttempts.get(identifier);

  // Decay: if the previous failure was long enough ago, start counting fresh.
  const isStale =
    existing !== undefined &&
    Date.now() - existing.lastAttemptAt >= ATTEMPT_DECAY_MS;
  const priorAttempts = isStale ? 0 : (existing?.attempts ?? 0);
  const attempts = priorAttempts + 1;
  const ms = lockoutMs(attempts);
  await db.loginAttempts.put({
    email: identifier,
    attempts,
    lockedUntil: ms > 0 ? Date.now() + ms : 0,
    lastAttemptAt: Date.now(),
  });
}

export async function clearAttempts(identifier: string): Promise<void> {
  await db.loginAttempts.delete(identifier);
}
